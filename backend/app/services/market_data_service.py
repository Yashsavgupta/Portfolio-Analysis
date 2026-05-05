from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional
import json

import logging

import yfinance as yf
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.instrument import Instrument
from app.models.portfolio import Portfolio

logger = logging.getLogger(__name__)

SYMBOL_ALIASES = {
    "HDFC": "HDFCBANK",
}


@dataclass
class MarketDataResult:
    symbol: str
    resolved_ticker: Optional[str]
    found: bool
    data: Dict[str, Any]
    message: str


def _candidate_tickers(symbol: str) -> list[str]:
    base = SYMBOL_ALIASES.get(symbol.strip().upper(), symbol.strip().upper())
    return [f"{base}.NS", f"{base}.BO", base]


def _normalize_info(symbol: str, ticker_symbol: str, info: Dict[str, Any]) -> Dict[str, Any]:
    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
    previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
    quote_type = (info.get("quoteType") or "").upper()
    long_name = info.get("longName") or info.get("shortName") or symbol

    return {
        "symbol": symbol,
        "ticker": ticker_symbol,
        "name": long_name,
        "current_price": current_price,
        "previous_close": previous_close,
        "high_52w": info.get("fiftyTwoWeekHigh"),
        "low_52w": info.get("fiftyTwoWeekLow"),
        "pe_ratio": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "price_to_book": info.get("priceToBook"),
        "dividend_yield": _ratio_to_percent(info.get("dividendYield")),
        "beta_1y": info.get("beta"),
        "market_cap": info.get("marketCap"),
        "eps_growth": _ratio_to_percent(info.get("earningsGrowth")),
        "revenue_growth": _ratio_to_percent(info.get("revenueGrowth")),
        "target_price": info.get("targetMeanPrice"),
        "promoter_holding": _ratio_to_percent(info.get("heldPercentInsiders")),
        "fii_holding": None,
        "dii_holding": None,
        "promoter_pledge": None,
        "sector": info.get("sector"),
        "is_etf": quote_type == "ETF",
        "asset_type": "ETF" if quote_type == "ETF" else "Stock",
        "quote_type": quote_type or None,
    }


def _ratio_to_percent(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return round(float(value) * 100, 2)
    except (TypeError, ValueError):
        return None


def fetch_market_data(symbol: str) -> MarketDataResult:
    last_error = None

    for candidate in _candidate_tickers(symbol):
        try:
            ticker = yf.Ticker(candidate)
            info = ticker.info
            if not info:
                continue

            current_price = info.get("currentPrice") or info.get("regularMarketPrice")
            trailing_pe = info.get("trailingPE")
            forward_pe = info.get("forwardPE")

            # Accept a result if we at least got a price or PE data.
            if current_price is None and trailing_pe is None and forward_pe is None:
                continue

            data = _normalize_info(symbol.strip().upper(), candidate, info)
            return MarketDataResult(
                symbol=symbol.strip().upper(),
                resolved_ticker=candidate,
                found=True,
                data=data,
                message="Market data fetched successfully",
            )
        except Exception as exc:
            last_error = str(exc)
            logger.warning("Failed fetching market data for %s via %s: %s", symbol, candidate, exc)

    return MarketDataResult(
        symbol=symbol.strip().upper(),
        resolved_ticker=None,
        found=False,
        data={},
        message=last_error or "No market data found for symbol",
    )


def update_instrument_market_data(instrument: Instrument, market_data: Dict[str, Any], db: Session) -> Instrument:
    instrument.name = market_data.get("name") or instrument.name
    instrument.asset_type = market_data.get("asset_type") or instrument.asset_type
    instrument.sector = market_data.get("sector") or instrument.sector
    instrument.current_price = market_data.get("current_price")
    instrument.previous_close = market_data.get("previous_close")
    instrument.high_52w = market_data.get("high_52w")
    instrument.low_52w = market_data.get("low_52w")
    instrument.pe_ratio = market_data.get("pe_ratio")
    instrument.forward_pe = market_data.get("forward_pe")
    instrument.price_to_book = market_data.get("price_to_book")
    instrument.dividend_yield = market_data.get("dividend_yield")
    instrument.beta_1y = market_data.get("beta_1y")
    instrument.market_cap = market_data.get("market_cap")
    instrument.eps_growth = market_data.get("eps_growth")
    instrument.revenue_growth = market_data.get("revenue_growth")
    instrument.target_price = market_data.get("target_price")
    instrument.promoter_holding = market_data.get("promoter_holding")
    instrument.fii_holding = market_data.get("fii_holding")
    instrument.dii_holding = market_data.get("dii_holding")
    instrument.promoter_pledge = market_data.get("promoter_pledge")
    instrument.is_etf = bool(market_data.get("is_etf"))
    instrument.extra_data = json.dumps(
        {
            "ticker": market_data.get("ticker"),
            "quote_type": market_data.get("quote_type"),
        }
    )
    db.add(instrument)
    return instrument


def refresh_portfolio_market_data(portfolio_id: int, user_id: int, db: Session) -> Dict[str, Any]:
    portfolio = (
        db.query(Portfolio)
        .filter(Portfolio.id == portfolio_id, Portfolio.user_id == user_id)
        .first()
    )
    if not portfolio:
        raise ValueError("Portfolio not found")

    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    instruments = _unique_instruments(holdings)

    refreshed = []
    failed = []

    for instrument in instruments:
        result = fetch_market_data(instrument.symbol)
        if not result.found:
            failed.append({"symbol": instrument.symbol, "message": result.message})
            continue

        update_instrument_market_data(instrument, result.data, db)
        refreshed.append(
            {
                "symbol": instrument.symbol,
                "ticker": result.resolved_ticker,
                "current_price": result.data.get("current_price"),
                "pe_ratio": result.data.get("pe_ratio"),
                "forward_pe": result.data.get("forward_pe"),
                "target_price": result.data.get("target_price"),
            }
        )

    db.commit()

    return {
        "portfolio_id": portfolio.id,
        "portfolio_name": portfolio.name,
        "refreshed_count": len(refreshed),
        "failed_count": len(failed),
        "refreshed": refreshed,
        "failed": failed,
    }


def _unique_instruments(holdings: Iterable[Holding]) -> list[Instrument]:
    seen = set()
    result = []
    for holding in holdings:
        if holding.instrument_id in seen:
            continue
        seen.add(holding.instrument_id)
        result.append(holding.instrument)
    return result
