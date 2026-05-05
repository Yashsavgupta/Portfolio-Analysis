from pathlib import Path
import sys

import pytest

pd = pytest.importorskip("pandas")
pytest.importorskip("sqlalchemy")
pytest.importorskip("yfinance")

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.models.holding import Holding
from app.models.instrument import Instrument
from app.models.portfolio import Portfolio
from app.services.analytics_service import PortfolioAnalyticsService
from app.services import portfolio_dashboard_service as dashboard_service


def make_holding(
    *,
    symbol: str,
    quantity: float,
    average_price: float,
    current_price: float,
    previous_close: float,
    invested_value: float,
    market_value: float,
    unrealized_pnl: float,
    unrealized_pnl_pct: float,
    quantity_long_term: float = 0,
    asset_type: str = "stock",
    sector: str = "Technology",
    instrument_current_price: float | None = None,
    instrument_previous_close: float | None = None,
    pe_ratio: float | None = None,
    forward_pe: float | None = None,
    target_price: float | None = None,
    high_52w: float | None = None,
    low_52w: float | None = None,
) -> Holding:
    instrument = Instrument(
        id=1,
        symbol=symbol,
        name=f"{symbol} Ltd",
        asset_type=asset_type,
        sector=sector,
        current_price=instrument_current_price,
        previous_close=instrument_previous_close,
        pe_ratio=pe_ratio,
        forward_pe=forward_pe,
        target_price=target_price,
        high_52w=high_52w,
        low_52w=low_52w,
        is_etf=False,
    )
    return Holding(
        id=1,
        portfolio_id=1,
        instrument_id=instrument.id,
        instrument=instrument,
        quantity=quantity,
        quantity_available=quantity,
        quantity_long_term=quantity_long_term,
        quantity_pledged_margin=0,
        quantity_pledged_loan=0,
        average_price=average_price,
        current_price=current_price,
        previous_closing_price=previous_close,
        market_value=market_value,
        invested_value=invested_value,
        unrealized_pnl=unrealized_pnl,
        unrealized_pnl_pct=unrealized_pnl_pct,
        is_long_term=quantity_long_term >= quantity,
    )


def test_dashboard_summary_uses_previous_day_value_for_daily_pct():
    holding = make_holding(
        symbol="ABC",
        quantity=10,
        average_price=80,
        current_price=110,
        previous_close=100,
        invested_value=800,
        market_value=1100,
        unrealized_pnl=300,
        unrealized_pnl_pct=37.5,
        quantity_long_term=10,
    )
    context = dashboard_service.PortfolioDashboardContext(
        portfolio=Portfolio(id=1, user_id=1, name="Core", type="equity", description=None),
        holdings=[holding],
        total_value=1100,
    )

    summary = dashboard_service._build_summary(context, {"portfolio_return_pct": None, "benchmark_returns": {}})

    assert summary["todays_pnl"] == 100
    assert summary["todays_pnl_pct"] == 10.0


def test_performance_history_reconstructs_quantity_weighted_portfolio(monkeypatch: pytest.MonkeyPatch):
    holding_a = make_holding(
        symbol="AAA",
        quantity=1,
        average_price=100,
        current_price=110,
        previous_close=108,
        invested_value=100,
        market_value=110,
        unrealized_pnl=10,
        unrealized_pnl_pct=10,
        quantity_long_term=1,
    )
    holding_b = make_holding(
        symbol="BBB",
        quantity=2,
        average_price=50,
        current_price=40,
        previous_close=42,
        invested_value=100,
        market_value=80,
        unrealized_pnl=-20,
        unrealized_pnl_pct=-20,
        quantity_long_term=2,
    )

    date_index = pd.to_datetime(["2025-01-01", "2025-01-02"])
    series_map = {
        "AAA.NS": pd.Series([100.0, 110.0], index=date_index, name="AAA.NS"),
        "BBB.NS": pd.Series([50.0, 40.0], index=date_index, name="BBB.NS"),
        "^NSEI": pd.Series([1000.0, 1050.0], index=date_index, name="^NSEI"),
    }

    monkeypatch.setattr(
        dashboard_service,
        "_download_close_series",
        lambda ticker, start, end: series_map.get(ticker),
    )

    history = dashboard_service._build_performance_history([holding_a, holding_b], ["^NSEI"])

    assert history["portfolio_return_pct"] == -5.0
    assert history["benchmark_returns"]["^NSEI"] == 5.0
    assert history["chart"][-1]["portfolio"] == -5.0


def test_valuation_metrics_forward_pe_uses_only_covered_holdings():
    holdings = [
        make_holding(
            symbol="AAA",
            quantity=10,
            average_price=100,
            current_price=100,
            previous_close=99,
            invested_value=1000,
            market_value=1000,
            unrealized_pnl=0,
            unrealized_pnl_pct=0,
            quantity_long_term=10,
            pe_ratio=20,
            forward_pe=16,
        ),
        make_holding(
            symbol="BBB",
            quantity=10,
            average_price=100,
            current_price=200,
            previous_close=198,
            invested_value=1000,
            market_value=2000,
            unrealized_pnl=1000,
            unrealized_pnl_pct=100,
            quantity_long_term=10,
            pe_ratio=30,
            forward_pe=None,
        ),
    ]

    metrics = PortfolioAnalyticsService(holdings).get_valuation_metrics()

    assert metrics["portfolio_pe"] == pytest.approx(26.67, rel=1e-3)
    assert metrics["portfolio_forward_pe"] == 16.0


def test_growth_forecast_uses_value_weighted_upside_and_fresh_instrument_price():
    holdings = [
        make_holding(
            symbol="AAA",
            quantity=10,
            average_price=100,
            current_price=95,
            previous_close=94,
            invested_value=1000,
            market_value=1000,
            unrealized_pnl=0,
            unrealized_pnl_pct=0,
            quantity_long_term=10,
            instrument_current_price=100,
            target_price=110,
        ),
        make_holding(
            symbol="BBB",
            quantity=5,
            average_price=100,
            current_price=145,
            previous_close=144,
            invested_value=500,
            market_value=500,
            unrealized_pnl=0,
            unrealized_pnl_pct=0,
            quantity_long_term=5,
            instrument_current_price=150,
            target_price=180,
        ),
    ]

    growth = PortfolioAnalyticsService(holdings).get_growth_forecast()

    assert growth["avg_target_upside"] == pytest.approx(13.33, rel=1e-3)


def test_tax_snapshot_nets_mixed_term_losses_before_estimated_tax():
    holdings = [
        make_holding(
            symbol="AAA",
            quantity=10,
            average_price=100,
            current_price=110,
            previous_close=109,
            invested_value=1000,
            market_value=1100,
            unrealized_pnl=100,
            unrealized_pnl_pct=10,
            quantity_long_term=5,
        ),
        make_holding(
            symbol="BBB",
            quantity=10,
            average_price=100,
            current_price=96,
            previous_close=97,
            invested_value=1000,
            market_value=960,
            unrealized_pnl=-40,
            unrealized_pnl_pct=-4,
            quantity_long_term=10,
        ),
        make_holding(
            symbol="CCC",
            quantity=10,
            average_price=100,
            current_price=97,
            previous_close=98,
            invested_value=1000,
            market_value=970,
            unrealized_pnl=-30,
            unrealized_pnl_pct=-3,
            quantity_long_term=0,
        ),
    ]

    snapshot = PortfolioAnalyticsService(holdings).get_tax_snapshot()

    assert snapshot["ltcg_gains"] == 50.0
    assert snapshot["stcg_gains"] == 50.0
    assert snapshot["ltcg_losses"] == 40.0
    assert snapshot["stcg_losses"] == 30.0
    assert snapshot["net_ltcg_gains"] == 10.0
    assert snapshot["net_stcg_gains"] == 20.0
    assert snapshot["estimated_ltcg_tax"] == 0.0
    assert snapshot["estimated_stcg_tax"] == 4.0
    assert snapshot["total_estimated_tax"] == 4.0
