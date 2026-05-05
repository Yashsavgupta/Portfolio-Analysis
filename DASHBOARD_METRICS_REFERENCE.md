# Dashboard Metrics Reference

This file lists the financial attributes currently exposed in the dashboard and analytics views, along with the formula or source used for each one.

## Price And Holding Inputs

- `price` / `current_price`: sourced from `instrument.current_price`, falling back to the imported holding snapshot `holding.current_price`, then `previous_closing_price`.
- `previous_close`: sourced from `instrument.previous_close`, falling back to `holding.previous_closing_price`, then `holding.current_price`.
- `quantity`: imported holding quantity.
- `invested_value`: imported holding invested amount. On parsed uploads it is `quantity * average_price`.
- `market_value`: `current_price * quantity` in the dashboard view.

## Main Dashboard Summary

- `total_value`: sum of holding `market_value`.
- `todays_pnl`: sum of `(current_price - previous_close) * quantity`.
- `todays_pnl_pct`: `todays_pnl / sum(previous_close * quantity) * 100`.
- `total_return`: `total_value - sum(invested_value)`.
- `total_return_pct`: `total_return / sum(invested_value) * 100`.
- `xirr`: currently not calculated; returned as `null` until cash-flow history exists.
- `portfolio_return_12m`: reconstructed 12-month return from quantity-weighted historical values, `((ending_portfolio_value / starting_portfolio_value) - 1) * 100`.
- `benchmark_return_12m`: same formula on the first selected benchmark index.
- `alpha_vs_benchmark`: `portfolio_return_12m - benchmark_return_12m`.

## Risk Metrics

- `beta`: covariance of portfolio daily returns vs first selected benchmark daily returns, divided by benchmark return variance.
- `sharpe_ratio`: `((mean_daily_return * 252) - 0.04) / annualized_volatility`.
- `max_drawdown`: worst peak-to-trough decline in the reconstructed cumulative return series.
- `value_at_risk_1d`: `total_value * 1.65 * daily_return_std_dev`.
- `annualized_volatility`: `daily_return_std_dev * sqrt(252) * 100`.
- `top_3_concentration`: sum of the three largest holding weights.

## Sector Allocation

- `sector_allocation[].value`: sum of holding `market_value` within the sector.
- `sector_allocation[].weight`: `sector_value / total_value * 100`.

## Holdings Table

- `previous_value`: `previous_close * quantity`.
- `day_pnl`: `(current_price - previous_close) * quantity`.
- `day_change_pct`: `(current_price - previous_close) / previous_close * 100`.
- `weight`: `market_value / total_value * 100`.
- `total_return_pct`: `(market_value - invested_value) / invested_value * 100`.
- `upside_pct`: `(target_price - current_price) / current_price * 100` when target price exists.
- `range_position`: `(current_price - low_52w) / (high_52w - low_52w) * 100` when both 52-week bounds exist.
- `rsi`: estimated 14-period RSI from downloaded close history.
- `signal`: `SELL` if upside is below `-5%`, RSI is above `70`, or PE is more than `1.25x` sector average with low upside; `BUY` if upside is at least `15%` and RSI is below `65`; otherwise `HOLD`.

## Fundamental Snapshot

- `portfolio_pe`, `portfolio_forward_pe`, `portfolio_price_to_book`, `portfolio_dividend_yield`, `portfolio_eps_growth`, `portfolio_revenue_growth`, `portfolio_promoter_holding`: market-value-weighted averages across holdings where that field is present.
- `analyst_coverage_count`: count of holdings with a `target_price`.
- `buy_signal_count`: count of holdings with signal `BUY`.
- `sell_signal_count`: count of holdings with signal `SELL`.
- `market_value_covered_pct`: percentage of portfolio market value for holdings that have `eps_growth` or `revenue_growth`.

## Stock And Mutual Fund Subpages

- `totalStockValue` / `totalMFValue`: sum of filtered holding `market_value`.
- `totalStockReturn` / `totalMFReturn`: filtered `total_value - total_invested`.
- `totalStockDayChangePct` / `totalMFDayChangePct`: filtered `sum(day_pnl) / sum(previous_value) * 100`.
- stock sector chart weights: recalculated from filtered stock holdings only, not reused from total portfolio weights.

## Analytics Endpoints

- `unrealized_pnl`: `current_value - invested_value`.
- `unrealized_pnl_pct`: `unrealized_pnl / invested_value * 100`.
- `sectors[].pct`: `sector_value / portfolio_value * 100`.
- `holdings[].pct` within sector analytics: `holding_value / sector_value * 100`.
- `avg_target_upside`: market-value-weighted average of per-holding upside percentages using the freshest available price.
- `portfolio_pct` in promoter/institutional analytics: `holding.market_value / total_portfolio_value * 100`.
- `long_term_qty_pct`: `sum(quantity_long_term) / sum(quantity) * 100`.
- `short_term_qty_pct`: `sum(quantity - quantity_long_term) / sum(quantity) * 100`.
- `diversification_score`: `clamp(((num_holdings - 2) * 10) - (top_3_pct - 30), 0, 100)`.
- `pct_below` 52-week high: `(high_52w - current_price) / high_52w * 100`.
- `ltcg_gains`, `stcg_gains`, `ltcg_losses`, `stcg_losses`: unrealized P&L split between long-term and short-term buckets in proportion to `quantity_long_term / quantity`.
- `net_stcg_gains`: `max(0, stcg_gains - stcg_losses)`.
- `net_ltcg_gains`: `max(0, ltcg_gains - remaining_stcg_losses - ltcg_losses)`.
- `ltcg_exemption_used`: `min(net_ltcg_gains, 125000)`.
- `estimated_ltcg_tax`: `max(0, net_ltcg_gains - exemption_used) * 12.5%`.
- `estimated_stcg_tax`: `net_stcg_gains * 20%`.
- `total_estimated_tax`: `estimated_ltcg_tax + estimated_stcg_tax`.
- `effective_tax_rate`: `total_estimated_tax / (net_ltcg_gains + net_stcg_gains) * 100`.

## Notes

- Benchmark history and RSI use downloaded market data.
- Valuation, growth, dividend, and promoter fields are sourced from market data, then aggregated by the formulas above.
- XIRR, realized tax-lot analytics, and true cash-flow-aware performance still require transaction history rather than a holdings snapshot.
