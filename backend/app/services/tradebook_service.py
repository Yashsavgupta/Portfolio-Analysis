"""Tradebook merge engine, FIFO P&L, and XIRR calculator."""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.stock_trade import StockTrade
from app.services.universal_parser import CanonicalTrade


# ── Legacy CSV Parser (Zerodha direct upload kept for backwards compat) ───────

def parse_tradebook_csv(content: str, user_id: int) -> list[StockTrade]:
    """Parse a Zerodha tradebook CSV directly. Returns unsaved StockTrade objects."""
    from app.services.universal_parser import parse_tradebook
    result = parse_tradebook(content)
    trades = []
    for item in result.stocks + result.mutual_funds:
        if not isinstance(item, CanonicalTrade):
            continue
        trades.append(_canonical_to_model(item, user_id))
    return trades


def _canonical_to_model(t: CanonicalTrade, user_id: int) -> StockTrade:
    return StockTrade(
        user_id=user_id,
        symbol=t.symbol,
        isin=t.isin,
        trade_date=t.trade_date,
        exchange=t.exchange,
        segment=t.segment,
        series=t.series,
        trade_type=t.trade_type,
        quantity=t.quantity,
        price=t.price,
        trade_value=t.trade_value,
        trade_id=t.trade_id,
        order_id=t.order_id,
        order_execution_time=t.order_execution_time,
    )


# ── Merge (incremental import) ────────────────────────────────────────────────

def _dedup_key(t: StockTrade) -> tuple:
    """Primary: trade_id. Fallback: composite of identifying fields."""
    if t.trade_id:
        return ('id', t.trade_id)
    return ('composite', t.symbol, str(t.trade_date), t.trade_type,
            round(t.quantity, 4), round(t.price, 4))


def merge_trades(new_trades: list[StockTrade], user_id: int, db: Session) -> dict:
    """
    Merge new_trades into existing history for user_id.
    Deduplicates by trade_id (when available) or by composite key.
    Returns import statistics including date ranges.
    """
    existing: list[StockTrade] = (
        db.query(StockTrade).filter(StockTrade.user_id == user_id).all()
    )

    existing_keys = {_dedup_key(t) for t in existing}

    added = 0
    skipped = 0
    for t in new_trades:
        key = _dedup_key(t)
        if key in existing_keys:
            skipped += 1
        else:
            db.add(t)
            existing_keys.add(key)
            added += 1

    db.commit()

    all_trades = existing + [t for t in new_trades if _dedup_key(t) not in
                             {_dedup_key(e) for e in existing}]

    # Date range of the new file
    new_dates = [t.trade_date for t in new_trades]
    file_range = {
        'from': min(new_dates).isoformat() if new_dates else None,
        'to':   max(new_dates).isoformat() if new_dates else None,
    }

    # Full history range after merge
    all_dates = [t.trade_date for t in db.query(StockTrade)
                 .filter(StockTrade.user_id == user_id).all()]
    merged_range = {
        'from': min(all_dates).isoformat() if all_dates else None,
        'to':   max(all_dates).isoformat() if all_dates else None,
    }

    # Pre-merge existing range
    existing_dates = [t.trade_date for t in existing]
    existing_range = {
        'from': min(existing_dates).isoformat() if existing_dates else None,
        'to':   max(existing_dates).isoformat() if existing_dates else None,
    }

    total = db.query(StockTrade).filter(StockTrade.user_id == user_id).count()

    return {
        'new_trades_added': added,
        'duplicates_skipped': skipped,
        'total_trades': total,
        'file_date_range': file_range,
        'existing_date_range': existing_range,
        'merged_date_range': merged_range,
        'gaps': _detect_gaps(merged_range['from'], merged_range['to'], user_id, db),
    }


# ── Gap detection ─────────────────────────────────────────────────────────────

def _detect_gaps(from_str: str | None, to_str: str | None,
                 user_id: int, db: Session,
                 gap_threshold_days: int = 45) -> list[dict]:
    """
    Return periods > gap_threshold_days with no trades.
    Ignores periods shorter than the threshold (weekends, holidays, etc.)
    """
    if not from_str or not to_str:
        return []

    trades = (
        db.query(StockTrade.trade_date)
        .filter(StockTrade.user_id == user_id)
        .order_by(StockTrade.trade_date)
        .all()
    )
    if len(trades) < 2:
        return []

    dates = sorted({t[0] for t in trades})
    gaps = []
    for i in range(1, len(dates)):
        delta = (dates[i] - dates[i - 1]).days
        if delta > gap_threshold_days:
            gaps.append({
                'from': (dates[i - 1] + timedelta(days=1)).isoformat(),
                'to':   (dates[i] - timedelta(days=1)).isoformat(),
                'days': delta - 1,
                'note': f'{delta - 1} days with no trades detected',
            })
    return gaps


# ── Trade coverage ────────────────────────────────────────────────────────────

def get_trade_coverage(user_id: int, db: Session) -> dict:
    """Return full date range, gap list, and per-year trade counts."""
    trades = (
        db.query(StockTrade)
        .filter(StockTrade.user_id == user_id)
        .order_by(StockTrade.trade_date)
        .all()
    )

    if not trades:
        return {
            'has_data': False,
            'from': None,
            'to': None,
            'total_trades': 0,
            'gaps': [],
            'by_year': {},
        }

    dates = [t.trade_date for t in trades]
    by_year: dict[int, int] = defaultdict(int)
    for d in dates:
        by_year[d.year] += 1

    from_date = min(dates)
    to_date = max(dates)

    gaps = _detect_gaps(from_date.isoformat(), to_date.isoformat(), user_id, db)

    return {
        'has_data': True,
        'from': from_date.isoformat(),
        'to': to_date.isoformat(),
        'total_trades': len(trades),
        'gaps': gaps,
        'by_year': dict(sorted(by_year.items())),
    }


# ── Legacy upsert (kept for reference, replaced by merge_trades) ──────────────

def upsert_trades(trades: list[StockTrade], user_id: int, db: Session) -> dict:
    """Replace all trades. Deprecated — use merge_trades for incremental imports."""
    db.query(StockTrade).filter(StockTrade.user_id == user_id).delete()
    for t in trades:
        db.add(t)
    db.commit()
    return {'inserted': len(trades)}


# ── XIRR ─────────────────────────────────────────────────────────────────────

def _xirr(cash_flows: list[tuple[date, float]], guess: float = 0.1) -> float | None:
    import math
    if not cash_flows:
        return None
    t0 = cash_flows[0][0]

    def years(d: date) -> float:
        return (d - t0).days / 365.25

    def npv(r: float) -> float:
        try:
            return sum(cf / (1 + r) ** years(d) for d, cf in cash_flows)
        except (ZeroDivisionError, OverflowError):
            return float('inf')

    def dnpv(r: float) -> float:
        try:
            return sum(-years(d) * cf / (1 + r) ** (years(d) + 1) for d, cf in cash_flows)
        except (ZeroDivisionError, OverflowError):
            return 0.0

    rate = guess
    for _ in range(200):
        if not math.isfinite(rate) or rate <= -1:
            return None
        f = npv(rate)
        df = dnpv(rate)
        if df == 0 or not math.isfinite(f) or not math.isfinite(df):
            return None
        new_rate = rate - f / df
        if not math.isfinite(new_rate):
            return None
        if abs(new_rate - rate) < 1e-7:
            result = round(new_rate * 100, 2)
            return result if math.isfinite(result) else None
        rate = new_rate
    return None


# ── FIFO Realized P&L ─────────────────────────────────────────────────────────

def calculate_fifo_realized_pnl(trades: list[StockTrade]) -> list[dict]:
    by_symbol: dict[str, list[StockTrade]] = defaultdict(list)
    for t in trades:
        by_symbol[t.symbol].append(t)

    lots: list[dict] = []
    for symbol, sym_trades in by_symbol.items():
        sym_trades.sort(key=lambda t: t.trade_date)
        buy_queue: list[list] = []

        for t in sym_trades:
            if t.trade_type == 'buy':
                buy_queue.append([t.trade_date, t.quantity, t.price])
            else:
                remaining = t.quantity
                while remaining > 0 and buy_queue:
                    buy_date, buy_qty, buy_price = buy_queue[0]
                    matched = min(buy_qty, remaining)
                    holding_days = (t.trade_date - buy_date).days
                    is_ltcg = holding_days > 365
                    buy_val = matched * buy_price
                    sell_val = matched * t.price
                    gain = sell_val - buy_val

                    lots.append({
                        'symbol': symbol,
                        'isin': t.isin,
                        'buy_date': buy_date.isoformat(),
                        'sell_date': t.trade_date.isoformat(),
                        'holding_days': holding_days,
                        'quantity': matched,
                        'buy_price': round(buy_price, 2),
                        'sell_price': round(t.price, 2),
                        'buy_value': round(buy_val, 2),
                        'sell_value': round(sell_val, 2),
                        'realized_gain': round(gain, 2),
                        'tax_category': 'LTCG' if is_ltcg else 'STCG',
                        'tax_rate': 12.5 if is_ltcg else 20.0,
                    })

                    buy_queue[0][1] -= matched
                    if buy_queue[0][1] <= 1e-6:
                        buy_queue.pop(0)
                    remaining -= matched

    lots.sort(key=lambda x: x['sell_date'], reverse=True)
    return lots


def _summarize_realized(lots: list[dict]) -> dict:
    ltcg_gain = sum(l['realized_gain'] for l in lots if l['tax_category'] == 'LTCG')
    stcg_gain = sum(l['realized_gain'] for l in lots if l['tax_category'] == 'STCG')
    ltcg_taxable = max(0, ltcg_gain - 100000.0)
    ltcg_tax = ltcg_taxable * 0.125
    stcg_tax = max(0, stcg_gain) * 0.20
    return {
        'total_realized': round(sum(l['realized_gain'] for l in lots), 2),
        'ltcg_gain': round(ltcg_gain, 2),
        'stcg_gain': round(stcg_gain, 2),
        'ltcg_taxable': round(ltcg_taxable, 2),
        'ltcg_tax': round(ltcg_tax, 2),
        'stcg_tax': round(stcg_tax, 2),
        'total_estimated_tax': round(ltcg_tax + stcg_tax, 2),
    }


# ── Open positions ────────────────────────────────────────────────────────────

def _open_positions(trades: list[StockTrade]) -> dict[str, dict]:
    by_symbol: dict[str, list[StockTrade]] = defaultdict(list)
    for t in trades:
        by_symbol[t.symbol].append(t)

    positions: dict[str, dict] = {}
    for symbol, sym_trades in by_symbol.items():
        sym_trades.sort(key=lambda t: t.trade_date)
        buy_queue: list[list] = []

        for t in sym_trades:
            if t.trade_type == 'buy':
                buy_queue.append([t.trade_date, t.quantity, t.price])
            else:
                remaining = t.quantity
                while remaining > 0 and buy_queue:
                    matched = min(buy_queue[0][1], remaining)
                    buy_queue[0][1] -= matched
                    if buy_queue[0][1] <= 1e-6:
                        buy_queue.pop(0)
                    remaining -= matched

        total_qty = sum(b[1] for b in buy_queue)
        if total_qty > 1e-6:
            avg_cost = sum(b[1] * b[2] for b in buy_queue) / total_qty
            earliest = min(b[0] for b in buy_queue)
            positions[symbol] = {
                'quantity': round(total_qty, 4),
                'avg_cost': round(avg_cost, 2),
                'total_invested': round(total_qty * avg_cost, 2),
                'first_buy_date': earliest.isoformat(),
            }
    return positions


# ── Portfolio analysis ────────────────────────────────────────────────────────

def calculate_trade_analysis(trades: list[StockTrade], current_prices: dict[str, float]) -> dict:
    today = date.today()
    positions = _open_positions(trades)
    lots = calculate_fifo_realized_pnl(trades)
    realized_summary = _summarize_realized(lots)

    cash_flows: list[tuple[date, float]] = []
    for t in sorted(trades, key=lambda x: x.trade_date):
        if t.trade_type == 'buy':
            cash_flows.append((t.trade_date, -t.trade_value))
        else:
            cash_flows.append((t.trade_date, t.trade_value))

    terminal = 0.0
    for sym, pos in positions.items():
        ltp = current_prices.get(sym, pos['avg_cost'])
        terminal += pos['quantity'] * ltp
    if terminal > 0:
        cash_flows.append((today, terminal))

    portfolio_xirr = _xirr(cash_flows) if len(cash_flows) >= 2 else None

    per_stock: list[dict] = []
    for sym, pos in positions.items():
        ltp = current_prices.get(sym, pos['avg_cost'])
        current_val = round(pos['quantity'] * ltp, 2)
        invested = pos['total_invested']
        unrealized = round(current_val - invested, 2)
        unrealized_pct = round(unrealized / invested * 100, 2) if invested else 0

        sym_trades = [t for t in trades if t.symbol == sym]
        sym_flows: list[tuple[date, float]] = []
        for t in sorted(sym_trades, key=lambda x: x.trade_date):
            if t.trade_type == 'buy':
                sym_flows.append((t.trade_date, -t.trade_value))
            else:
                sym_flows.append((t.trade_date, t.trade_value))
        sym_flows.append((today, current_val))
        stock_xirr = _xirr(sym_flows) if len(sym_flows) >= 2 else None

        sym_lots = [l for l in lots if l['symbol'] == sym]
        sym_realized = sum(l['realized_gain'] for l in sym_lots)
        holding_days = (today - date.fromisoformat(pos['first_buy_date'])).days

        per_stock.append({
            'symbol': sym,
            'quantity': pos['quantity'],
            'avg_cost': pos['avg_cost'],
            'ltp': round(ltp, 2),
            'invested': round(invested, 2),
            'current_value': current_val,
            'unrealized_gain': unrealized,
            'unrealized_pct': unrealized_pct,
            'realized_gain': round(sym_realized, 2),
            'total_gain': round(unrealized + sym_realized, 2),
            'xirr': stock_xirr,
            'holding_days': holding_days,
            'first_buy_date': pos['first_buy_date'],
        })

    per_stock.sort(key=lambda x: abs(x['current_value']), reverse=True)
    total_invested = sum(p['invested'] for p in per_stock)
    total_current = sum(p['current_value'] for p in per_stock)
    total_unrealized = total_current - total_invested

    return {
        'portfolio_xirr': portfolio_xirr,
        'total_invested': round(total_invested, 2),
        'total_current_value': round(total_current, 2),
        'total_unrealized_gain': round(total_unrealized, 2),
        'total_unrealized_pct': round(total_unrealized / total_invested * 100, 2) if total_invested else 0,
        'realized_summary': realized_summary,
        'open_positions_count': len(positions),
        'per_stock': per_stock,
    }
