from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import json
import logging
import math
from typing import Any, Dict, Iterable, Optional

import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session, joinedload

from app.models.holding import Holding
from app.models.portfolio import Portfolio

logger = logging.getLogger(__name__)

TRADING_DAYS = 252
RISK_FREE_RATE = 0.04


@dataclass
class PortfolioDashboardContext:
    portfolio: Portfolio
    holdings: list[Holding]
    total_value: float


def build_portfolio_dashboard(user_id: int, db: Session, portfolio_id: Optional[int] = None, indices: list[str] = None) -> Dict[str, Any]:
    if indices is None:
        indices = ["^NSEI"]  # Default to Nifty 50
    
    context = _load_context(user_id, db, portfolio_id)
    history = _build_performance_history(context.holdings, indices)
    summary = _build_summary(context, history)
    risk = _build_risk_metrics(context, history)
    sectors = _build_sector_allocation(context.holdings)
    holdings = _build_holdings_table(context.holdings, context.total_value)
    fundamentals = _build_fundamental_snapshot(holdings)
    commentary = _build_market_commentary(summary, risk, sectors, holdings)

    return {
        "portfolio": {
            "id": context.portfolio.id,
            "name": context.portfolio.name,
            "type": context.portfolio.type,
            "description": context.portfolio.description,
        },
        "summary": summary,
        "risk_metrics": risk,
        "performance_chart": history["chart"],
        "sector_allocation": sectors,
        "holdings": holdings,
        "fundamentals": fundamentals,
        "market_commentary": commentary,
        "data_gaps": _missing_info_items(),
    }


def _load_context(user_id: int, db: Session, portfolio_id: Optional[int]) -> PortfolioDashboardContext:
    query = (
        db.query(Portfolio)
        .options(joinedload(Portfolio.holdings).joinedload(Holding.instrument))
        .filter(Portfolio.user_id == user_id)
        .order_by(Portfolio.id.desc())
    )
    if portfolio_id is not None:
        query = query.filter(Portfolio.id == portfolio_id)

    portfolio = query.first()
    if not portfolio:
        raise ValueError("No imported portfolio found. Upload holdings first.")

    holdings = list(portfolio.holdings)
    if not holdings:
        raise ValueError("Portfolio has no holdings.")

    total_value = sum(_current_market_value(holding) for holding in holdings)
    return PortfolioDashboardContext(portfolio=portfolio, holdings=holdings, total_value=total_value)


def _current_price(holding: Holding) -> float:
    return float(
        holding.instrument.current_price
        or holding.current_price
        or holding.previous_closing_price
        or 0
    )


def _previous_close(holding: Holding) -> float:
    return float(
        holding.instrument.previous_close
        or holding.previous_closing_price
        or holding.current_price
        or 0
    )


def _current_market_value(holding: Holding) -> float:
    return _current_price(holding) * float(holding.quantity)


def _resolve_ticker(holding: Holding) -> Optional[str]:
    extra = holding.instrument.extra_data
    if extra:
        try:
            payload = json.loads(extra)
            ticker = payload.get("ticker")
            if ticker:
                return ticker
        except json.JSONDecodeError:
            pass

    symbol = holding.instrument.symbol.strip().upper()
    aliases = {"HDFC": "HDFCBANK"}
    symbol = aliases.get(symbol, symbol)
    return f"{symbol}.NS"


def _download_close_series(ticker: str, start: datetime, end: datetime) -> Optional[pd.Series]:
    try:
        data = yf.download(ticker, start=start.date(), end=end.date(), progress=False, auto_adjust=True)
        if data.empty:
            return None
        close = data["Close"].dropna()
        if isinstance(close, pd.DataFrame):
            if close.empty:
                return None
            close = close.iloc[:, 0]
        if close.empty:
            return None
        close.name = ticker
        return close
    except Exception as exc:
        logger.warning("Failed downloading history for %s: %s", ticker, exc)
        return None


def _build_performance_history(holdings: list[Holding], indices: list[str]) -> Dict[str, Any]:
    end = datetime.utcnow()
    start = end - timedelta(days=370)
    holding_series: list[tuple[Holding, pd.Series]] = []

    for holding in holdings:
        ticker = _resolve_ticker(holding)
        if not ticker:
            continue
        close = _download_close_series(ticker, start, end)
        if close is None:
            continue
        holding_series.append((holding, close))

    # Download all benchmark indices
    benchmarks = {}
    for index in indices:
        benchmark_data = _download_close_series(index, start, end)
        if benchmark_data is not None:
            benchmarks[index] = benchmark_data

    if not holding_series or not benchmarks:
        return {
            "chart": [],
            "portfolio_return_pct": None,
            "benchmark_returns": {},
            "daily_returns": [],
            "benchmark_daily_returns": {},
        }

    prices = pd.concat([series for _, series in holding_series], axis=1).ffill().dropna(how="all").dropna()
    if prices.empty:
        return {
            "chart": [],
            "portfolio_return_pct": None,
            "benchmark_returns": {},
            "daily_returns": [],
            "benchmark_daily_returns": {},
        }

    portfolio_values: Dict[str, pd.Series] = {}
    for holding, close_series in holding_series:
        aligned_close = close_series.reindex(prices.index).ffill()
        if aligned_close.isna().all():
            continue
        quantity = float(holding.quantity)
        portfolio_values[f"{holding.instrument_id}:{holding.instrument.symbol}"] = aligned_close * quantity

    if not portfolio_values:
        return {
            "chart": [],
            "portfolio_return_pct": None,
            "benchmark_returns": {},
            "daily_returns": [],
            "benchmark_daily_returns": {},
        }

    portfolio_frame = pd.DataFrame(portfolio_values).dropna(how="all").ffill().dropna()
    if portfolio_frame.empty:
        return {
            "chart": [],
            "portfolio_return_pct": None,
            "benchmark_returns": {},
            "daily_returns": [],
            "benchmark_daily_returns": {},
        }

    portfolio_market_value = portfolio_frame.sum(axis=1)
    if portfolio_market_value.empty or portfolio_market_value.iloc[0] <= 0:
        return {
            "chart": [],
            "portfolio_return_pct": None,
            "benchmark_returns": {},
            "daily_returns": [],
            "benchmark_daily_returns": {},
        }

    portfolio_index = portfolio_market_value / portfolio_market_value.iloc[0]
    
    # Align all benchmarks with portfolio index
    aligned_data = {"portfolio": portfolio_index}
    for index_name, benchmark_series in benchmarks.items():
        benchmark_aligned = benchmark_series.reindex(portfolio_index.index).ffill().dropna()
        portfolio_aligned = portfolio_index.reindex(benchmark_aligned.index).dropna()
        benchmark_aligned = benchmark_aligned.reindex(portfolio_aligned.index)
        
        if not portfolio_aligned.empty and not benchmark_aligned.empty:
            benchmark_index = benchmark_aligned / benchmark_aligned.iloc[0]
            aligned_data[index_name] = benchmark_index

    if len(aligned_data) <= 1:  # Only portfolio, no benchmarks
        return {
            "chart": [],
            "portfolio_return_pct": None,
            "benchmark_returns": {},
            "daily_returns": [],
            "benchmark_daily_returns": {},
        }

    # Create aligned DataFrame
    aligned_df = pd.DataFrame(aligned_data).dropna()
    if aligned_df.empty:
        return {
            "chart": [],
            "portfolio_return_pct": None,
            "benchmark_returns": {},
            "daily_returns": [],
            "benchmark_daily_returns": {},
        }

    # Calculate portfolio returns for risk metrics
    portfolio_returns = aligned_df["portfolio"].pct_change().dropna()
    benchmark_daily_returns = {
        index_name: aligned_df[index_name].pct_change().dropna().tolist()
        for index_name in benchmarks.keys()
        if index_name in aligned_df.columns
    }
    
    # Build chart data
    chart = []
    for index, row in aligned_df.iterrows():
        chart_entry = {
            "date": index.strftime("%Y-%m-%d"),
            "portfolio": round((row["portfolio"] - 1) * 100, 2),
        }
        # Add all benchmark indices
        for index_name in benchmarks.keys():
            if index_name in row:
                chart_entry[index_name] = round((row[index_name] - 1) * 100, 2)
        chart.append(chart_entry)

    # Calculate returns
    portfolio_return_pct = round((aligned_df["portfolio"].iloc[-1] - 1) * 100, 2)
    benchmark_returns = {}
    for index_name in benchmarks.keys():
        if index_name in aligned_df.columns:
            benchmark_returns[index_name] = round((aligned_df[index_name].iloc[-1] - 1) * 100, 2)

    return {
        "chart": chart,
        "portfolio_return_pct": portfolio_return_pct,
        "benchmark_returns": benchmark_returns,
        "daily_returns": portfolio_returns.tolist(),
        "benchmark_daily_returns": benchmark_daily_returns,
    }


def _build_summary(context: PortfolioDashboardContext, history: Dict[str, Any]) -> Dict[str, Any]:
    total_invested = sum(float(h.invested_value) for h in context.holdings)
    total_value = context.total_value
    total_return = total_value - total_invested
    total_return_pct = (total_return / total_invested * 100) if total_invested > 0 else 0
    todays_pnl = sum((_current_price(h) - _previous_close(h)) * float(h.quantity) for h in context.holdings)
    previous_total_value = sum(_previous_close(h) * float(h.quantity) for h in context.holdings)
    todays_pnl_pct = (todays_pnl / previous_total_value * 100) if previous_total_value > 0 else 0

    portfolio_return_pct = history.get("portfolio_return_pct")
    benchmark_returns = history.get("benchmark_returns", {})
    
    # Use the first benchmark for alpha calculation (typically Nifty 50)
    benchmark_return_pct = None
    if benchmark_returns:
        first_benchmark = next(iter(benchmark_returns.keys()))
        benchmark_return_pct = benchmark_returns[first_benchmark]
    
    alpha = (
        round(portfolio_return_pct - benchmark_return_pct, 2)
        if portfolio_return_pct is not None and benchmark_return_pct is not None
        else None
    )

    return {
        "total_value": round(total_value, 2),
        "todays_pnl": round(todays_pnl, 2),
        "todays_pnl_pct": round(todays_pnl_pct, 2),
        "total_return": round(total_return, 2),
        "total_return_pct": round(total_return_pct, 2),
        "xirr": None,
        "alpha_vs_benchmark": alpha,
        "portfolio_return_12m": portfolio_return_pct,
        "benchmark_return_12m": benchmark_return_pct,
    }


def _build_risk_metrics(context: PortfolioDashboardContext, history: Dict[str, Any]) -> Dict[str, Any]:
    returns = history.get("daily_returns") or []
    benchmark_daily_returns = history.get("benchmark_daily_returns", {})
    
    # Use the first benchmark for beta calculation
    benchmark_returns = None
    if benchmark_daily_returns:
        first_benchmark = next(iter(benchmark_daily_returns.keys()))
        benchmark_returns = benchmark_daily_returns[first_benchmark]
    
    top_weights = sorted(
        [
            (_current_market_value(holding) / context.total_value * 100) if context.total_value > 0 else 0
            for holding in context.holdings
        ],
        reverse=True,
    )
    top_3_concentration = round(sum(top_weights[:3]), 2)

    if len(returns) < 2:
        return {
            "beta": None,
            "sharpe_ratio": None,
            "max_drawdown": None,
            "value_at_risk_1d": None,
            "annualized_volatility": None,
            "top_3_concentration": top_3_concentration,
        }

    mean_daily = sum(returns) / len(returns)
    std_daily = _std_dev(returns)
    annualized_vol = std_daily * math.sqrt(TRADING_DAYS)
    sharpe = ((mean_daily * TRADING_DAYS) - RISK_FREE_RATE) / annualized_vol if annualized_vol > 0 else None
    var_1d = context.total_value * 1.65 * std_daily
    max_drawdown = _max_drawdown_from_returns(returns)
    beta = _beta(returns, benchmark_returns) if benchmark_returns else None

    return {
        "beta": round(beta, 2) if beta is not None else None,
        "sharpe_ratio": round(sharpe, 2) if sharpe is not None else None,
        "max_drawdown": round(max_drawdown, 2) if max_drawdown is not None else None,
        "value_at_risk_1d": round(var_1d, 2),
        "annualized_volatility": round(annualized_vol * 100, 2),
        "top_3_concentration": top_3_concentration,
    }


def _build_sector_allocation(holdings: list[Holding]) -> list[Dict[str, Any]]:
    total = sum(_current_market_value(holding) for holding in holdings)
    sectors: Dict[str, float] = {}
    for holding in holdings:
        sector = holding.instrument.sector or "Others"
        sectors[sector] = sectors.get(sector, 0) + _current_market_value(holding)

    return [
        {
            "name": sector,
            "value": round(value, 2),
            "weight": round((value / total * 100) if total > 0 else 0, 2),
        }
        for sector, value in sorted(sectors.items(), key=lambda item: item[1], reverse=True)
    ]


def _build_holdings_table(holdings: list[Holding], total_value: float) -> list[Dict[str, Any]]:
    rows = []
    sector_avg_pe: Dict[str, float] = {}

    for holding in holdings:
        sector = holding.instrument.sector or "Others"
        pe = holding.instrument.pe_ratio
        if pe:
            sector_avg_pe.setdefault(sector, [])
            sector_avg_pe[sector].append(pe)

    sector_avg_pe = {
        sector: sum(values) / len(values)
        for sector, values in sector_avg_pe.items()
    }

    for holding in holdings:
        current_price = _current_price(holding)
        previous_close = _previous_close(holding)
        quantity = float(holding.quantity)
        market_value = _current_market_value(holding)
        invested_value = float(holding.invested_value)
        previous_value = previous_close * quantity
        day_pnl = (current_price - previous_close) * quantity
        day_change_pct = ((current_price - previous_close) / previous_close * 100) if previous_close > 0 else 0
        total_return_pct = ((market_value - invested_value) / invested_value * 100) if invested_value > 0 else 0
        weight = (market_value / total_value * 100) if total_value > 0 else 0
        target = holding.instrument.target_price
        upside_pct = ((target - current_price) / current_price * 100) if target and current_price > 0 else None
        low_52w = holding.instrument.low_52w
        high_52w = holding.instrument.high_52w
        range_position = None
        if low_52w is not None and high_52w is not None and high_52w > low_52w:
            range_position = round(((current_price - low_52w) / (high_52w - low_52w)) * 100, 2)

        rsi = _estimate_rsi(holding)
        signal = _build_signal(holding, upside_pct, rsi, sector_avg_pe)

        rows.append(
            {
                "symbol": holding.instrument.symbol,
                "name": holding.instrument.name,
                "sector": holding.instrument.sector,
                "asset_type": holding.instrument.asset_type,
                "quantity": round(quantity, 2),
                "price": round(current_price, 2),
                "previous_close": round(previous_close, 2),
                "previous_value": round(previous_value, 2),
                "day_pnl": round(day_pnl, 2),
                "day_change_pct": round(day_change_pct, 2),
                "invested_value": round(invested_value, 2),
                "market_value": round(market_value, 2),
                "weight": round(weight, 2),
                "total_return_pct": round(total_return_pct, 2),
                "pe_ratio": holding.instrument.pe_ratio,
                "forward_pe": holding.instrument.forward_pe,
                "price_to_book": holding.instrument.price_to_book,
                "dividend_yield": holding.instrument.dividend_yield,
                "target_price": target,
                "upside_pct": round(upside_pct, 2) if upside_pct is not None else None,
                "range_position": range_position,
                "high_52w": high_52w,
                "low_52w": low_52w,
                "rsi": rsi,
                "beta": holding.instrument.beta_1y,
                "promoter_holding": holding.instrument.promoter_holding,
                "eps_growth": holding.instrument.eps_growth,
                "revenue_growth": holding.instrument.revenue_growth,
                "signal": signal,
            }
        )

    rows.sort(key=lambda item: item["market_value"], reverse=True)
    return rows


def _estimate_rsi(holding: Holding) -> Optional[float]:
    ticker = _resolve_ticker(holding)
    if not ticker:
        return None
    end = datetime.utcnow()
    start = end - timedelta(days=40)
    series = _download_close_series(ticker, start, end)
    if series is None or len(series) < 15:
        return None

    delta = series.diff().dropna()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.tail(14).mean()
    avg_loss = losses.tail(14).mean()
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _build_signal(
    holding: Holding,
    upside_pct: Optional[float],
    rsi: Optional[float],
    sector_avg_pe: Dict[str, float],
) -> str:
    pe_ratio = holding.instrument.pe_ratio
    sector_avg = sector_avg_pe.get(holding.instrument.sector or "Others")

    sell_flag = (upside_pct is not None and upside_pct < -5) or (rsi is not None and rsi > 70)
    if pe_ratio and sector_avg and pe_ratio > sector_avg * 1.25 and (upside_pct or 0) < 5:
        sell_flag = True
    if sell_flag:
        return "SELL"

    if (upside_pct is not None and upside_pct >= 15) and (rsi is None or rsi < 65):
        return "BUY"

    return "HOLD"


def _build_market_commentary(
    summary: Dict[str, Any],
    risk: Dict[str, Any],
    sectors: list[Dict[str, Any]],
    holdings: list[Dict[str, Any]],
) -> list[str]:
    comments = []
    if summary.get("alpha_vs_benchmark") is not None:
        alpha = summary["alpha_vs_benchmark"]
        direction = "ahead of" if alpha >= 0 else "behind"
        comments.append(f"The portfolio is {abs(alpha):.2f}% {direction} the benchmark over the reconstructed 12-month view.")

    if sectors:
        largest = sectors[0]
        comments.append(f"The largest sector exposure is {largest['name']} at {largest['weight']:.2f}% of the portfolio.")

    if risk.get("top_3_concentration") is not None:
        comments.append(f"Top-3 holdings concentration is {risk['top_3_concentration']:.2f}%, which is the key single-name risk to monitor.")

    sell_names = [holding["symbol"] for holding in holdings if holding["signal"] == "SELL"][:3]
    if sell_names:
        comments.append(f"Sell signals are currently triggered for {', '.join(sell_names)} based on upside, RSI, and valuation inputs.")

    comments.append("XIRR shown in the dashboard needs real transaction dates and cash flows before it can be treated as an investable metric.")
    return comments


def _build_fundamental_snapshot(holdings: list[Dict[str, Any]]) -> Dict[str, Any]:
    total_value = sum(float(holding["market_value"]) for holding in holdings)

    def weighted_average(field: str) -> Optional[float]:
        weighted_sum = 0.0
        weight_total = 0.0
        for holding in holdings:
            value = holding.get(field)
            market_value = float(holding["market_value"])
            if value is None or market_value <= 0:
                continue
            weighted_sum += float(value) * market_value
            weight_total += market_value
        if weight_total == 0:
            return None
        return round(weighted_sum / weight_total, 2)

    return {
        "portfolio_pe": weighted_average("pe_ratio"),
        "portfolio_forward_pe": weighted_average("forward_pe"),
        "portfolio_price_to_book": weighted_average("price_to_book"),
        "portfolio_dividend_yield": weighted_average("dividend_yield"),
        "portfolio_eps_growth": weighted_average("eps_growth"),
        "portfolio_revenue_growth": weighted_average("revenue_growth"),
        "portfolio_promoter_holding": weighted_average("promoter_holding"),
        "analyst_coverage_count": sum(1 for holding in holdings if holding.get("target_price") is not None),
        "sell_signal_count": sum(1 for holding in holdings if holding.get("signal") == "SELL"),
        "buy_signal_count": sum(1 for holding in holdings if holding.get("signal") == "BUY"),
        "market_value_covered_pct": round(
            (
                sum(
                    float(holding["market_value"])
                    for holding in holdings
                    if holding.get("eps_growth") is not None or holding.get("revenue_growth") is not None
                )
                / total_value
                * 100
            )
            if total_value > 0
            else 0,
            2,
        ),
    }


def _missing_info_items() -> list[str]:
    return [
        "Transaction dates and cash-flow history are required for true XIRR and accurate time-weighted return.",
        "Benchmark comparison uses the first selected index for alpha and beta; add your preferred benchmark selection if you want a different primary comparison basis.",
        "Promoter holding is currently sourced as an insider/promoter proxy where available; a dedicated Indian shareholding-pattern feed would improve accuracy.",
        "True realized return, tax lots, and thesis tracking need buy/sell transaction history rather than a holdings snapshot.",
    ]


def _std_dev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / (len(values) - 1)
    return math.sqrt(variance)


def _max_drawdown_from_returns(returns: list[float]) -> Optional[float]:
    if not returns:
        return None
    cumulative = 1.0
    peak = 1.0
    max_drawdown = 0.0
    for daily_return in returns:
        cumulative *= 1 + daily_return
        peak = max(peak, cumulative)
        drawdown = (cumulative - peak) / peak
        max_drawdown = min(max_drawdown, drawdown)
    return abs(max_drawdown) * 100


def _beta(returns: list[float], benchmark_returns: list[float]) -> Optional[float]:
    length = min(len(returns), len(benchmark_returns))
    if length < 2:
        return None
    r = returns[-length:]
    b = benchmark_returns[-length:]
    mean_r = sum(r) / length
    mean_b = sum(b) / length
    covariance = sum((rv - mean_r) * (bv - mean_b) for rv, bv in zip(r, b)) / (length - 1)
    variance_b = sum((bv - mean_b) ** 2 for bv in b) / (length - 1)
    if variance_b == 0:
        return None
    return covariance / variance_b
