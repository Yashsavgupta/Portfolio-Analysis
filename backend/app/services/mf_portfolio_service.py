"""
Deep portfolio analytics for mutual fund holdings.
Covers: XIRR/performance, allocation breakdown, tax planning, risk overview.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.mutual_fund import MutualFund, MutualFundHolding

logger = logging.getLogger(__name__)


# ─── Math helpers ────────────────────────────────────────────────────────────

def _xirr(cash_flows: list[tuple[date, float]]) -> Optional[float]:
    """Newton-Raphson XIRR.  cash_flows = [(date, amount), ...]
    Negative amount = outflow (investment); positive = inflow (redemption/current value).
    Returns annualised rate, e.g. 0.12 = 12 %.
    """
    if not cash_flows or len(cash_flows) < 2:
        return None
    dates, amounts = zip(*cash_flows)
    base = min(dates)
    years = np.array([(d - base).days / 365.25 for d in dates])
    cf = np.array(amounts, dtype=float)

    def npv(r):
        return np.sum(cf / (1 + r) ** years)

    def dnpv(r):
        return np.sum(-years * cf / (1 + r) ** (years + 1))

    r = 0.10
    for _ in range(200):
        f = npv(r)
        df = dnpv(r)
        if abs(df) < 1e-12:
            break
        r_new = r - f / df
        if abs(r_new - r) < 1e-8:
            return round(r_new * 100, 2)
        r = max(-0.9999, r_new)
    return None


def _cagr(invested: float, current: float, days: int) -> Optional[float]:
    if invested <= 0 or days <= 1:
        return None
    years = days / 365.25
    return round(((current / invested) ** (1 / years) - 1) * 100, 2)


def _active_holdings(db: Session, portfolio_id: int) -> list[MutualFundHolding]:
    return (
        db.query(MutualFundHolding)
        .filter(
            MutualFundHolding.portfolio_id == portfolio_id,
            MutualFundHolding.is_active == True,
        )
        .all()
    )


def _fund(db: Session, fund_id: int) -> Optional[MutualFund]:
    return db.query(MutualFund).filter(MutualFund.id == fund_id).first()


# ─── 1. XIRR / Performance ───────────────────────────────────────────────────

def get_xirr_performance(db: Session, portfolio_id: int) -> dict:
    holdings = _active_holdings(db, portfolio_id)
    if not holdings:
        return {"error": "No holdings found"}

    today = date.today()
    total_invested = 0.0
    total_current = 0.0
    cash_flows: list[tuple[date, float]] = []
    fund_rows = []

    for h in holdings:
        f = _fund(db, h.mutual_fund_id)
        invested = float(h.cost_basis or 0)
        current = float(h.current_value or 0)
        days = int(h.holding_days or 0) if h.holding_days else (today - h.purchase_date).days

        total_invested += invested
        total_current += current
        cash_flows.append((h.purchase_date, -invested))

        cagr = _cagr(invested, current, days)
        gain = current - invested
        gain_pct = round(gain / invested * 100, 2) if invested > 0 else 0.0

        raw_cat = (f.category if f else "") or ""
        fname = (f.name if f else "") or ""
        fund_rows.append({
            "holding_id": h.id,
            "fund_name": fname or "Unknown",
            "fund_house": (f.fund_house if f else "") or "",
            "category": _infer_category(raw_cat, fname),
            "plan_type": h.plan_type,
            "purchase_date": h.purchase_date.isoformat(),
            "holding_days": days,
            "is_long_term": h.is_long_term,
            "invested": round(invested, 2),
            "current_value": round(current, 2),
            "gain_loss": round(gain, 2),
            "gain_loss_pct": gain_pct,
            "cagr": cagr,
            "fund_1y_return": f.return_1y if f else None,
            "fund_3y_return": f.return_3y if f else None,
            "fund_5y_return": f.return_5y if f else None,
        })

    # Add current value as terminal inflow at today
    cash_flows.append((today, total_current))

    portfolio_xirr = _xirr(cash_flows)
    total_gain = total_current - total_invested
    total_days = (today - min(h.purchase_date for h in holdings)).days
    portfolio_cagr = _cagr(total_invested, total_current, total_days)
    absolute_return_pct = round(total_gain / total_invested * 100, 2) if total_invested > 0 else 0

    # Sort best/worst
    sorted_by_cagr = sorted(
        [r for r in fund_rows if r["cagr"] is not None],
        key=lambda x: x["cagr"],
    )
    best = sorted_by_cagr[-3:][::-1] if sorted_by_cagr else []
    worst = sorted_by_cagr[:3] if sorted_by_cagr else []

    return {
        "portfolio_xirr": portfolio_xirr,
        "portfolio_cagr": portfolio_cagr,
        "absolute_return_pct": absolute_return_pct,
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current, 2),
        "total_gain_loss": round(total_gain, 2),
        "total_holding_days": total_days,
        "num_funds": len(holdings),
        "fund_performance": sorted(fund_rows, key=lambda x: -(x["current_value"])),
        "best_performers": best,
        "worst_performers": worst,
    }


# ─── 2. Allocation Breakdown ─────────────────────────────────────────────────

_EQUITY_KEYWORDS = [
    "equity", "elss", "large cap", "mid cap", "small cap", "flexi cap", "multi cap",
    "sectoral", "thematic", "focused", "focussed", "contra", "dividend yield", "value",
    "nifty", "sensex", "index fund", "bse", "nse", "bluechip", "opportunities",
    "growth", "alpha", "momentum", "quant", "factor",
]
_DEBT_KEYWORDS = [
    "debt", "liquid", "money market", "overnight", "ultra short", "low duration",
    "short duration", "medium duration", "long duration", "gilt", "floater",
    "credit risk", "banking and psu", "corporate bond", "dynamic bond", "fixed maturity",
    "arbitrage",  # arbitrage uses equity taxation but debt-like in nature → keep as debt
]
_HYBRID_KEYWORDS = [
    "hybrid", "balanced advantage", "aggressive hybrid", "conservative hybrid",
    "multi asset", "dynamic asset allocation", "equity savings",
]


def _infer_asset_type(category: str, fund_name: str) -> str:
    text = (category + " " + fund_name).lower()
    if any(k in text for k in _EQUITY_KEYWORDS):
        return "Equity"
    if any(k in text for k in _HYBRID_KEYWORDS):
        return "Hybrid"
    if any(k in text for k in _DEBT_KEYWORDS):
        return "Debt"
    return "Other"


def _infer_category(category: str, fund_name: str) -> str:
    """When DB category is generic ('Mutual Fund'), try to derive a better label from the name."""
    if category and category.lower() not in ("mutual fund", "other", "unknown", ""):
        return category
    name = fund_name.lower()
    if "elss" in name or "tax saver" in name or "tax saving" in name:
        return "ELSS"
    if "liquid" in name:
        return "Liquid"
    if "overnight" in name:
        return "Overnight"
    if "gilt" in name:
        return "Gilt"
    if "nifty 50" in name or "nifty50" in name or "sensex" in name:
        return "Large Cap Index"
    if "nifty next 50" in name or "nifty100" in name or "nifty 100" in name:
        return "Large & Mid Cap Index"
    if "midcap" in name or "mid cap" in name:
        return "Mid Cap"
    if "smallcap" in name or "small cap" in name:
        return "Small Cap"
    if "large cap" in name or "largecap" in name or "bluechip" in name or "blue chip" in name:
        return "Large Cap"
    if "flexi cap" in name or "flexicap" in name or "multi cap" in name or "multicap" in name:
        return "Flexi / Multi Cap"
    if "focused" in name or "focussed" in name:
        return "Focused Equity"
    if "balanced advantage" in name or "dynamic asset allocation" in name:
        return "Balanced Advantage"
    if "hybrid" in name or "balanced" in name:
        return "Hybrid"
    if "debt" in name or "bond" in name or "corporate" in name or "credit" in name:
        return "Debt"
    if "index" in name:
        return "Index Fund"
    return "Equity"  # safe default for most schemes


def _bucket(d: dict, key: str, invested: float, current: float):
    if key not in d:
        d[key] = {"invested": 0.0, "current_value": 0.0, "count": 0}
    d[key]["invested"] += invested
    d[key]["current_value"] += current
    d[key]["count"] += 1


def _to_list(d: dict, total_current: float) -> list[dict]:
    rows = []
    for name, v in d.items():
        rows.append({
            "name": name,
            "invested": round(v["invested"], 2),
            "current_value": round(v["current_value"], 2),
            "gain_loss": round(v["current_value"] - v["invested"], 2),
            "weight": round(v["current_value"] / total_current * 100, 2) if total_current > 0 else 0,
            "count": v["count"],
        })
    return sorted(rows, key=lambda x: -x["current_value"])


def get_allocation_detail(db: Session, portfolio_id: int) -> dict:
    holdings = _active_holdings(db, portfolio_id)
    if not holdings:
        return {"error": "No holdings found"}

    by_category: dict = {}
    by_fund_house: dict = {}
    by_asset_type: dict = {}
    by_plan_type: dict = {}
    top_holdings = []

    total_current = sum(float(h.current_value or 0) for h in holdings)

    for h in holdings:
        f = _fund(db, h.mutual_fund_id)
        invested = float(h.cost_basis or 0)
        current = float(h.current_value or 0)

        raw_category = (f.category if f else None) or ""
        fund_name_str = (f.name if f else "") or ""
        category = _infer_category(raw_category, fund_name_str)
        fund_house = (f.fund_house if f else None) or "Other"
        plan_type = (h.plan_type or "Unknown").title()
        asset_type = _infer_asset_type(raw_category, fund_name_str)

        _bucket(by_category, category, invested, current)
        _bucket(by_fund_house, fund_house, invested, current)
        _bucket(by_asset_type, asset_type, invested, current)
        _bucket(by_plan_type, plan_type, invested, current)

        top_holdings.append({
            "fund_name": f.name if f else "Unknown",
            "fund_house": fund_house,
            "category": category,
            "plan_type": plan_type,
            "invested": round(invested, 2),
            "current_value": round(current, 2),
            "weight": round(current / total_current * 100, 2) if total_current > 0 else 0,
            "gain_loss_pct": round((current - invested) / invested * 100, 2) if invested > 0 else 0,
        })

    top_holdings.sort(key=lambda x: -x["current_value"])

    # Concentration risk: Herfindahl-Hirschman Index (HHI)
    weights = [h["weight"] / 100 for h in top_holdings]
    hhi = round(sum(w ** 2 for w in weights) * 10000, 1)  # scaled 0–10000
    concentration_label = "Low" if hhi < 1500 else ("Moderate" if hhi < 2500 else "High")

    return {
        "total_invested": round(sum(float(h.cost_basis or 0) for h in holdings), 2),
        "total_current_value": round(total_current, 2),
        "num_funds": len(holdings),
        "by_category": _to_list(by_category, total_current),
        "by_fund_house": _to_list(by_fund_house, total_current),
        "by_asset_type": _to_list(by_asset_type, total_current),
        "by_plan_type": _to_list(by_plan_type, total_current),
        "top_holdings": top_holdings[:10],
        "hhi": hhi,
        "concentration_label": concentration_label,
    }


# ─── 3. Tax Deep Dive ────────────────────────────────────────────────────────

LTCG_EQUITY_EXEMPTION = 100_000  # ₹1 lakh exempt per year
LTCG_EQUITY_RATE = 0.125         # 12.5% post-July 2024 budget
STCG_EQUITY_RATE = 0.20          # 20% post-July 2024 budget
LTCG_DEBT_RATE = None            # taxed at slab rate (can't compute without slab)


def get_tax_deep_dive(db: Session, portfolio_id: int) -> dict:
    holdings = _active_holdings(db, portfolio_id)
    today = date.today()

    ltcg_equity_gains = 0.0
    stcg_equity_gains = 0.0
    ltcg_equity_holdings = []
    stcg_equity_holdings = []
    debt_holdings = []
    harvest_opportunities = []
    upcoming_ltcg = []  # become LT within 60 days

    for h in holdings:
        f = _fund(db, h.mutual_fund_id)
        invested = float(h.cost_basis or 0)
        current = float(h.current_value or 0)
        gain = current - invested
        days = int(h.holding_days or 0) if h.holding_days else (today - h.purchase_date).days
        raw_category = (f.category if f else "") or ""
        fund_name_str = (f.name if f else "") or ""
        asset_type = _infer_asset_type(raw_category, fund_name_str)
        category = _infer_category(raw_category, fund_name_str)
        is_equity = asset_type in ("Equity", "Hybrid")

        fund_name = f.name if f else "Unknown"
        row = {
            "holding_id": h.id,
            "fund_name": fund_name,
            "category": category,
            "purchase_date": h.purchase_date.isoformat(),
            "holding_days": days,
            "invested": round(invested, 2),
            "current_value": round(current, 2),
            "gain_loss": round(gain, 2),
            "gain_loss_pct": round(gain / invested * 100, 2) if invested > 0 else 0,
        }

        if is_equity:
            if days >= 365:  # LTCG equity
                ltcg_equity_gains += gain
                ltcg_equity_holdings.append(row)
            else:
                stcg_equity_gains += gain
                stcg_equity_holdings.append(row)
                days_to_lt = 365 - days
                if days_to_lt <= 60:
                    upcoming_ltcg.append({**row, "days_to_ltcg": days_to_lt})
        else:
            debt_holdings.append({**row, "holding_days": days})

        # Tax harvesting: unrealised loss > 500 — flag for potential realisation
        if gain < -500:
            harvest_opportunities.append({
                **row,
                "potential_tax_saving": round(
                    abs(gain) * (LTCG_EQUITY_RATE if days >= 365 else STCG_EQUITY_RATE)
                    if is_equity else 0,
                    2,
                ),
            })

    # LTCG equity: 12.5% on gains exceeding ₹1 lakh
    taxable_ltcg = max(0, ltcg_equity_gains - LTCG_EQUITY_EXEMPTION)
    ltcg_equity_tax = round(taxable_ltcg * LTCG_EQUITY_RATE, 2)
    stcg_equity_tax = round(max(0, stcg_equity_gains) * STCG_EQUITY_RATE, 2)

    return {
        "ltcg_equity": {
            "total_gains": round(ltcg_equity_gains, 2),
            "exempt_amount": LTCG_EQUITY_EXEMPTION,
            "taxable_gains": round(taxable_ltcg, 2),
            "tax_rate": LTCG_EQUITY_RATE * 100,
            "estimated_tax": ltcg_equity_tax,
            "holdings": sorted(ltcg_equity_holdings, key=lambda x: -x["gain_loss"]),
            "holdings_count": len(ltcg_equity_holdings),
        },
        "stcg_equity": {
            "total_gains": round(stcg_equity_gains, 2),
            "tax_rate": STCG_EQUITY_RATE * 100,
            "estimated_tax": stcg_equity_tax,
            "holdings": sorted(stcg_equity_holdings, key=lambda x: -x["gain_loss"]),
            "holdings_count": len(stcg_equity_holdings),
        },
        "debt_holdings": {
            "count": len(debt_holdings),
            "note": "Debt fund gains taxed at your income-tax slab rate (no LTCG/STCG distinction post-April 2023)",
            "holdings": debt_holdings,
        },
        "total_estimated_tax": round(ltcg_equity_tax + stcg_equity_tax, 2),
        "tax_harvest_opportunities": sorted(harvest_opportunities, key=lambda x: x["gain_loss"]),
        "upcoming_ltcg_eligibility": sorted(upcoming_ltcg, key=lambda x: x["days_to_ltcg"]),
    }


# ─── 4. Risk Overview ────────────────────────────────────────────────────────

def get_risk_overview(db: Session, portfolio_id: int) -> dict:
    holdings = _active_holdings(db, portfolio_id)
    if not holdings:
        return {"error": "No holdings found"}

    total_current = sum(float(h.current_value or 0) for h in holdings)
    fund_risk_rows = []

    w_sharpe = 0.0
    w_std_dev = 0.0
    w_max_dd = 0.0
    w_beta = 0.0
    sharpe_weight_sum = 0.0
    std_weight_sum = 0.0
    dd_weight_sum = 0.0
    beta_weight_sum = 0.0

    category_set: set = set()
    fund_house_set: set = set()

    for h in holdings:
        f = _fund(db, h.mutual_fund_id)
        current = float(h.current_value or 0)
        weight = current / total_current if total_current > 0 else 0

        category_set.add((f.category if f else "Unknown") or "Unknown")
        fund_house_set.add((f.fund_house if f else "Unknown") or "Unknown")

        sharpe = f.sharpe_ratio if f else None
        std_dev = f.std_dev_1y if f else None
        max_dd = f.max_drawdown if f else None
        beta = f.beta if f else None

        if sharpe is not None:
            w_sharpe += sharpe * weight
            sharpe_weight_sum += weight
        if std_dev is not None:
            w_std_dev += std_dev * weight
            std_weight_sum += weight
        if max_dd is not None:
            w_max_dd += max_dd * weight
            dd_weight_sum += weight
        if beta is not None:
            w_beta += beta * weight
            beta_weight_sum += weight

        fund_risk_rows.append({
            "fund_name": f.name if f else "Unknown",
            "category": (f.category if f else "") or "",
            "weight_pct": round(weight * 100, 2),
            "current_value": round(current, 2),
            "sharpe_ratio": sharpe,
            "std_dev_1y": std_dev,
            "max_drawdown": max_dd,
            "beta": beta,
            "expense_ratio": f.expense_ratio if f else None,
            "rating": f.rating if f else None,
        })

    def w_avg(val, wsum):
        return round(val / wsum, 3) if wsum > 0 else None

    # Concentration via HHI
    weights_arr = [float(h.current_value or 0) / total_current for h in holdings if total_current > 0]
    hhi = round(sum(w ** 2 for w in weights_arr) * 10000, 1)

    has_risk_data = std_weight_sum > 0 or sharpe_weight_sum > 0

    return {
        "portfolio_weighted_sharpe": w_avg(w_sharpe, sharpe_weight_sum),
        "portfolio_weighted_std_dev": w_avg(w_std_dev, std_weight_sum),
        "portfolio_weighted_max_drawdown": w_avg(w_max_dd, dd_weight_sum),
        "portfolio_weighted_beta": w_avg(w_beta, beta_weight_sum),
        "num_categories": len(category_set),
        "num_fund_houses": len(fund_house_set),
        "num_funds": len(holdings),
        "hhi": hhi,
        "concentration_label": "Low" if hhi < 1500 else ("Moderate" if hhi < 2500 else "High"),
        "category_diversification": len(category_set) >= 3,
        "has_risk_data": has_risk_data,
        "fund_risk_metrics": sorted(fund_risk_rows, key=lambda x: -x["weight_pct"]),
    }
