from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.holding import Holding
from app.models.mutual_fund import MutualFundHolding
from app.models.portfolio import Portfolio
from app.models.stock_trade import StockTrade
from app.models.user import User
from app.schemas.portfolio import PortfolioRead
from app.services.portfolio_dashboard_service import build_portfolio_dashboard
from app.services.tradebook_service import (
    calculate_fifo_realized_pnl,
    calculate_trade_analysis,
    parse_tradebook_csv,
    merge_trades,
    get_trade_coverage,
    _summarize_realized,
)
from app.services.universal_parser import parse_tradebook, CanonicalTrade
from app.services.tradebook_service import _canonical_to_model

router = APIRouter()


@router.get('/', response_model=list[PortfolioRead])
def list_portfolios():
    return [
        {'id': 1, 'name': 'Total Portfolio', 'type': 'total', 'description': 'Combined stock and mutual fund view.'},
        {'id': 2, 'name': 'Stock Portfolio', 'type': 'stock', 'description': 'Your stock holdings.'},
    ]


@router.get('/dashboard')
def get_portfolio_dashboard(
    portfolio_id: Optional[int] = None,
    indices: List[str] = Query(["^NSEI"], description="List of benchmark indices to compare against (e.g., ^NSEI, ^GSPC)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return build_portfolio_dashboard(current_user.id, db, portfolio_id, indices)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get('/combined-summary')
def get_combined_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a unified summary of stock + mutual fund holdings for the current user."""

    # ── Stocks ──────────────────────────────────────────────────────────────
    stock_portfolios = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.type != 'mutual_funds')
        .order_by(Portfolio.id.desc())
        .all()
    )

    stock_value = 0.0
    stock_invested = 0.0
    stock_count = 0
    stock_portfolio_id = None
    stock_portfolio_name = None

    for p in stock_portfolios:
        holdings = (
            db.query(Holding)
            .options(joinedload(Holding.instrument))
            .filter(Holding.portfolio_id == p.id)
            .all()
        )
        if holdings:
            stock_portfolio_id = p.id
            stock_portfolio_name = p.name
            # Mirror _current_price() in portfolio_dashboard_service: live instrument
            # price (set by yfinance refresh) first, then CSV LTP, then previous close.
            stock_value = sum(
                (
                    (h.instrument.current_price if h.instrument else None)
                    or h.current_price
                    or h.previous_closing_price
                    or 0
                ) * h.quantity
                for h in holdings
            )
            stock_invested = sum(h.invested_value or 0 for h in holdings)
            stock_count = len(holdings)
            break

    # ── Mutual Funds ─────────────────────────────────────────────────────────
    mf_portfolios = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.type == 'mutual_funds')
        .order_by(Portfolio.id.desc())
        .all()
    )

    mf_value = 0.0
    mf_invested = 0.0
    mf_count = 0
    mf_portfolio_id = None
    mf_portfolio_name = None

    for p in mf_portfolios:
        holdings = (
            db.query(MutualFundHolding)
            .filter(MutualFundHolding.portfolio_id == p.id, MutualFundHolding.is_active == True)
            .all()
        )
        if holdings:
            mf_portfolio_id = p.id
            mf_portfolio_name = p.name
            mf_value = sum(h.current_value or 0 for h in holdings)
            mf_invested = sum(h.cost_basis or 0 for h in holdings)
            mf_count = len(holdings)
            break

    # ── Totals ────────────────────────────────────────────────────────────────
    total_value = stock_value + mf_value
    total_invested = stock_invested + mf_invested
    total_return = total_value - total_invested

    def pct(gain, base):
        return round(gain / base * 100, 2) if base > 0 else 0.0

    asset_allocation = []
    if stock_value > 0:
        asset_allocation.append({"name": "Stocks", "value": round(stock_value, 2), "weight": round(stock_value / total_value * 100, 2) if total_value else 0})
    if mf_value > 0:
        asset_allocation.append({"name": "Mutual Funds", "value": round(mf_value, 2), "weight": round(mf_value / total_value * 100, 2) if total_value else 0})

    return {
        "stocks": {
            "portfolio_id": stock_portfolio_id,
            "portfolio_name": stock_portfolio_name,
            "total_value": round(stock_value, 2),
            "total_invested": round(stock_invested, 2),
            "total_return": round(stock_value - stock_invested, 2),
            "total_return_pct": pct(stock_value - stock_invested, stock_invested),
            "holdings_count": stock_count,
        },
        "mutual_funds": {
            "portfolio_id": mf_portfolio_id,
            "portfolio_name": mf_portfolio_name,
            "total_value": round(mf_value, 2),
            "total_invested": round(mf_invested, 2),
            "total_return": round(mf_value - mf_invested, 2),
            "total_return_pct": pct(mf_value - mf_invested, mf_invested),
            "holdings_count": mf_count,
        },
        "total": {
            "total_value": round(total_value, 2),
            "total_invested": round(total_invested, 2),
            "total_return": round(total_return, 2),
            "total_return_pct": pct(total_return, total_invested),
        },
        "asset_allocation": asset_allocation,
    }


# ── Tradebook endpoints ───────────────────────────────────────────────────────

@router.post('/upload-tradebook')
async def upload_tradebook(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a tradebook CSV (any supported broker). Merges with existing history —
    duplicates are skipped, new trades are added. Returns date ranges and gap info.
    """
    content_bytes = await file.read()
    try:
        content = content_bytes.decode('utf-8-sig')
    except UnicodeDecodeError:
        content = content_bytes.decode('latin-1')

    result = parse_tradebook(content)
    if result.unrecognised:
        # Fall back to legacy Zerodha parser
        trades = parse_tradebook_csv(content, current_user.id)
    else:
        trades = [
            _canonical_to_model(item, current_user.id)
            for item in result.stocks + result.mutual_funds
            if isinstance(item, CanonicalTrade)
        ]

    if not trades:
        raise HTTPException(status_code=400, detail='No valid trades found in the uploaded file.')

    stats = merge_trades(trades, current_user.id, db)
    return {
        'message': f"Successfully imported {stats['new_trades_added']} new trades ({stats['duplicates_skipped']} duplicates skipped).",
        'broker': result.broker if not result.unrecognised else 'zerodha',
        **stats,
    }


@router.get('/trade-coverage')
def get_trade_coverage_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return full trade history date range, per-year counts, and detected gaps."""
    return get_trade_coverage(current_user.id, db)


@router.get('/trade-analysis')
def get_trade_analysis(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """XIRR + per-stock performance summary from stored tradebook data."""
    trades = db.query(StockTrade).filter(StockTrade.user_id == current_user.id).all()
    if not trades:
        return {
            'portfolio_xirr': None,
            'total_invested': 0,
            'total_current_value': 0,
            'total_unrealized_gain': 0,
            'total_unrealized_pct': 0,
            'realized_summary': {},
            'open_positions_count': 0,
            'per_stock': [],
            'no_trades': True,
        }

    # Fetch current prices AND holdings-based totals from the portfolio snapshot.
    # Holdings CSV is the authoritative source for current value — using it here
    # ensures this page matches the overview page exactly.
    current_prices: dict[str, float] = {}
    holdings_total_value: float | None = None
    holdings_total_invested: float | None = None
    try:
        stock_portfolios = (
            db.query(Portfolio)
            .filter(Portfolio.user_id == current_user.id, Portfolio.type != 'mutual_funds')
            .order_by(Portfolio.id.desc())
            .all()
        )
        for p in stock_portfolios:
            port_holdings = (
                db.query(Holding)
                .options(joinedload(Holding.instrument))
                .filter(Holding.portfolio_id == p.id)
                .all()
            )
            if not port_holdings:
                continue
            for h in port_holdings:
                sym = h.instrument.symbol if h.instrument else None
                # Mirror _current_price() in portfolio_dashboard_service:
                # prefer live instrument price (set by market-data refresh / yfinance),
                # fall back to the price stored in the holding row at import time.
                price = (
                    (h.instrument.current_price if h.instrument else None)
                    or h.current_price
                    or h.previous_closing_price
                )
                if sym and price:
                    current_prices[sym.upper()] = price
            # Portfolio snapshot totals — same formula as the overview page.
            holdings_total_value = sum(
                (
                    (h.instrument.current_price if h.instrument else None)
                    or h.current_price
                    or h.previous_closing_price
                    or 0
                ) * h.quantity
                for h in port_holdings
            )
            holdings_total_invested = sum(h.invested_value for h in port_holdings)
            break
    except Exception:
        pass

    try:
        result = calculate_trade_analysis(trades, current_prices)

        # Override the trade-derived totals with holdings-based ones so the
        # "Total Invested" and "Current Value" on this page match the overview.
        if holdings_total_value is not None and holdings_total_invested is not None:
            unrealized = holdings_total_value - holdings_total_invested
            result['total_current_value'] = round(holdings_total_value, 2)
            result['total_invested'] = round(holdings_total_invested, 2)
            result['total_unrealized_gain'] = round(unrealized, 2)
            result['total_unrealized_pct'] = (
                round(unrealized / holdings_total_invested * 100, 2)
                if holdings_total_invested else 0
            )

        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Trade analysis failed: {exc}') from exc


@router.get('/realized-pnl')
def get_realized_pnl(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """FIFO realized P&L broken down by lot with LTCG/STCG classification."""
    trades = db.query(StockTrade).filter(StockTrade.user_id == current_user.id).all()
    if not trades:
        return {'lots': [], 'summary': {}, 'no_trades': True}

    lots = calculate_fifo_realized_pnl(trades)
    summary = _summarize_realized(lots)
    return {'lots': lots, 'summary': summary}


@router.get('/trades')
def list_trades(
    symbol: Optional[str] = None,
    trade_type: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Paginated list of raw trades, optionally filtered by symbol or trade_type."""
    q = db.query(StockTrade).filter(StockTrade.user_id == current_user.id)
    if symbol:
        q = q.filter(StockTrade.symbol == symbol.upper())
    if trade_type in ('buy', 'sell'):
        q = q.filter(StockTrade.trade_type == trade_type)

    total = q.count()
    trades = q.order_by(StockTrade.trade_date.desc(), StockTrade.id.desc()).offset(offset).limit(limit).all()

    return {
        'total': total,
        'limit': limit,
        'offset': offset,
        'trades': [
            {
                'id': t.id,
                'symbol': t.symbol,
                'isin': t.isin,
                'trade_date': t.trade_date.isoformat(),
                'exchange': t.exchange,
                'segment': t.segment,
                'series': t.series,
                'trade_type': t.trade_type,
                'quantity': t.quantity,
                'price': t.price,
                'trade_value': t.trade_value,
                'trade_id': t.trade_id,
                'order_id': t.order_id,
                'order_execution_time': t.order_execution_time,
            }
            for t in trades
        ],
    }
