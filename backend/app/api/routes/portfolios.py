from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.holding import Holding
from app.models.mutual_fund import MutualFundHolding
from app.models.portfolio import Portfolio
from app.models.user import User
from app.schemas.portfolio import PortfolioRead
from app.services.portfolio_dashboard_service import build_portfolio_dashboard

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
        holdings = db.query(Holding).filter(Holding.portfolio_id == p.id).all()
        if holdings:
            stock_portfolio_id = p.id
            stock_portfolio_name = p.name
            stock_value = sum(h.market_value or 0 for h in holdings)
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
