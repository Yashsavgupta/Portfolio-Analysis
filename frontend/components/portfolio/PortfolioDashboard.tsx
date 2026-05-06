'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { apiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';

type NullableNumber = number | null;

interface PortfolioMeta {
  id: number;
  name: string;
  type: string;
  description: string | null;
}

interface Summary {
  total_value: number;
  todays_pnl: number;
  todays_pnl_pct: number;
  total_return: number;
  total_return_pct: number;
  xirr: NullableNumber;
  alpha_vs_benchmark: NullableNumber;
  portfolio_return_12m: NullableNumber;
  benchmark_return_12m: NullableNumber;
}

interface RiskMetrics {
  beta: NullableNumber;
  sharpe_ratio: NullableNumber;
  max_drawdown: NullableNumber;
  value_at_risk_1d: NullableNumber;
  annualized_volatility: NullableNumber;
  top_3_concentration: NullableNumber;
}

interface PerformancePoint {
  date: string;
  portfolio: number;
  benchmark: number;
}

interface SectorAllocation {
  name: string;
  value: number;
  weight: number;
}

interface HoldingRow {
  symbol: string;
  name: string;
  sector: string | null;
  quantity: number;
  price: number;
  previous_close: number;
  previous_value: number;
  day_pnl: number;
  day_change_pct: number;
  invested_value: number;
  market_value: number;
  weight: number;
  total_return_pct: number;
  asset_type: string | null;
  pe_ratio: NullableNumber;
  forward_pe: NullableNumber;
  price_to_book: NullableNumber;
  dividend_yield: NullableNumber;
  target_price: NullableNumber;
  upside_pct: NullableNumber;
  range_position: NullableNumber;
  high_52w: NullableNumber;
  low_52w: NullableNumber;
  rsi: NullableNumber;
  beta: NullableNumber;
  promoter_holding: NullableNumber;
  eps_growth: NullableNumber;
  revenue_growth: NullableNumber;
  signal: 'BUY' | 'HOLD' | 'SELL';
}

interface Fundamentals {
  portfolio_pe: NullableNumber;
  portfolio_forward_pe: NullableNumber;
  portfolio_price_to_book: NullableNumber;
  portfolio_dividend_yield: NullableNumber;
  portfolio_eps_growth: NullableNumber;
  portfolio_revenue_growth: NullableNumber;
  portfolio_promoter_holding: NullableNumber;
  analyst_coverage_count: number;
  sell_signal_count: number;
  buy_signal_count: number;
  market_value_covered_pct: number;
}

interface PortfolioDashboardResponse {
  portfolio: PortfolioMeta;
  summary: Summary;
  risk_metrics: RiskMetrics;
  performance_chart: PerformancePoint[];
  sector_allocation: SectorAllocation[];
  holdings: HoldingRow[];
  fundamentals: Fundamentals;
  market_commentary: string[];
  data_gaps: string[];
}

const DONUT_COLORS = ['#14b8a6', '#38bdf8', '#f59e0b', '#f97316', '#ef4444', '#a78bfa', '#84cc16', '#e879f9'];

const INDEX_OPTIONS = [
  { ticker: '^NSEI', name: 'NIFTY 50', color: '#2dd4bf' },
  { ticker: '^BSESN', name: 'S&P BSE SENSEX', color: '#38bdf8' },
  { ticker: '^NSEBANK', name: 'NIFTY BANK', color: '#f59e0b' },
  { ticker: '^CNXIT', name: 'NIFTY IT', color: '#f97316' },
  { ticker: '^CNXAUTO', name: 'NIFTY AUTO', color: '#ef4444' },
  { ticker: '^CNXENERGY', name: 'NIFTY ENERGY', color: '#a78bfa' },
  { ticker: '^CNXFMCG', name: 'NIFTY FMCG', color: '#84cc16' },
  { ticker: '^CNXMETAL', name: 'NIFTY METAL', color: '#e879f9' },
  { ticker: '^CNXPHARMA', name: 'NIFTY PHARMA', color: '#f97316' },
  { ticker: '^CNXREALTY', name: 'NIFTY REALTY', color: '#8b5cf6' },
  { ticker: '^GSPC', name: 'S&P 500', color: '#06b6d4' },
];

function formatCurrency(value: NullableNumber) {
  if (value === null) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: NullableNumber, digits = 2) {
  if (value === null) return 'N/A';
  return `${value.toFixed(digits)}%`;
}

function formatMultiple(value: NullableNumber) {
  if (value === null) return 'N/A';
  return `${value.toFixed(2)}x`;
}

function formatNumber(value: NullableNumber, digits = 2) {
  if (value === null) return 'N/A';
  return value.toFixed(digits);
}

function metricTone(value: NullableNumber) {
  if (value === null) return 'text-slate-100';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-rose-400';
  return 'text-slate-100';
}

function signalClasses(signal: HoldingRow['signal']) {
  if (signal === 'BUY') return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30';
  if (signal === 'SELL') return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30';
  return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30';
}

function SummaryTile({
  label,
  value,
  detail,
  toneClass = 'text-slate-100',
}: {
  label: string;
  value: string;
  detail?: string;
  toneClass?: string;
}) {
  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`mt-3 text-xl font-semibold sm:text-2xl ${toneClass}`}>{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-slate-400">{detail}</div> : <div className="mt-2 text-sm text-transparent">.</div>}
    </div>
  );
}

function RangeBar({ position }: { position: NullableNumber }) {
  const safePosition = position === null ? 0 : Math.min(Math.max(position, 0), 100);

  return (
    <div className="min-w-[9rem] max-w-[12rem]">
      <div className="h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
          style={{ width: `${safePosition}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-slate-400">{position === null ? 'N/A' : `${safePosition.toFixed(0)}% of range`}</div>
    </div>
  );
}

function HoldingMetric({
  label,
  value,
  detail,
  toneClass = 'text-slate-100',
}: {
  label: string;
  value: string;
  detail?: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-sm font-semibold ${toneClass}`}>{value}</div>
      {detail ? <div className="mt-1 text-xs text-slate-400">{detail}</div> : null}
    </div>
  );
}

function HoldingCard({ holding }: { holding: HoldingRow }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-100">{holding.symbol}</div>
          <div className="mt-1 text-sm text-slate-300">{holding.name}</div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            {holding.sector || 'Unclassified'}
          </div>
        </div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${signalClasses(holding.signal)}`}>
          {holding.signal}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <HoldingMetric
          label="Price"
          value={formatCurrency(holding.price)}
          detail={`Prev close ${formatCurrency(holding.previous_close)}`}
        />
        <HoldingMetric
          label="Day Move"
          value={formatCurrency(holding.day_pnl)}
          detail={formatPercent(holding.day_change_pct)}
          toneClass={metricTone(holding.day_pnl)}
        />
        <HoldingMetric
          label="Value"
          value={formatCurrency(holding.market_value)}
          detail={`Weight ${formatPercent(holding.weight)}`}
        />
        <HoldingMetric
          label="Total Return"
          value={formatPercent(holding.total_return_pct)}
          detail={`Invested ${formatCurrency(holding.invested_value)}`}
          toneClass={metricTone(holding.total_return_pct)}
        />
        <HoldingMetric
          label="Analyst Target"
          value={formatCurrency(holding.target_price)}
          detail={formatPercent(holding.upside_pct)}
          toneClass={metricTone(holding.upside_pct)}
        />
        <HoldingMetric
          label="Valuation"
          value={formatMultiple(holding.pe_ratio)}
          detail={`Forward ${formatMultiple(holding.forward_pe)}`}
        />
        <HoldingMetric
          label="Growth"
          value={formatPercent(holding.eps_growth)}
          detail={`Revenue ${formatPercent(holding.revenue_growth)}`}
        />
        <HoldingMetric
          label="Risk"
          value={`RSI ${formatNumber(holding.rsi)}`}
          detail={`Beta ${formatNumber(holding.beta)}`}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">52W Range</div>
          <div className="text-xs text-slate-400">{`Promoter ${formatPercent(holding.promoter_holding)}`}</div>
        </div>
        <RangeBar position={holding.range_position} />
        <div className="text-xs text-slate-500">
          {`Low ${formatCurrency(holding.low_52w)} / High ${formatCurrency(holding.high_52w)}`}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioDashboard() {
  const [dashboard, setDashboard] = useState<PortfolioDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<string[]>(['^NSEI']); // Default to Nifty 50

  const loadDashboard = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);
      const token = getToken();
      
      // Build query string with selected indices
      const indicesQuery = selectedIndices.map(idx => `indices=${encodeURIComponent(idx)}`).join('&');
      const url = `${apiUrl('/api/portfolios/dashboard')}?${indicesQuery}`;
      
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Failed to load portfolio dashboard');
      }
      setDashboard(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load portfolio dashboard');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadDashboard();
  }, [selectedIndices]);

  const handleIndexToggle = (ticker: string) => {
    setSelectedIndices(prev => {
      if (prev.includes(ticker)) {
        // Don't allow removing the last index
        if (prev.length === 1) return prev;
        return prev.filter(idx => idx !== ticker);
      } else {
        return [...prev, ticker];
      }
    });
  };

  const getIndexColor = (ticker: string) => {
    const indexOption = INDEX_OPTIONS.find(opt => opt.ticker === ticker);
    return indexOption?.color || '#94a3b8';
  };

  const getIndexName = (ticker: string) => {
    const indexOption = INDEX_OPTIONS.find(opt => opt.ticker === ticker);
    return indexOption?.name || ticker;
  };

  const refreshMarketData = async () => {
    if (!dashboard) return;

    try {
      setRefreshing(true);
      const token = getToken();
      const response = await fetch(apiUrl(`/api/market-data/refresh/${dashboard.portfolio.id}`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        await loadDashboard(false);
      }
      // Don't set error for refresh failures - just silently fail and reload data
    } catch {
      // Silently fail on refresh errors - data still loads from cache
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/20">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && !dashboard) {
    const isMissingPortfolio = error.toLowerCase().includes('upload holdings') || error.toLowerCase().includes('no imported portfolio');
    return (
      <EmptyState
        title={isMissingPortfolio ? 'Import Holdings To Start' : 'Portfolio Dashboard Error'}
        description={error}
        action={
          isMissingPortfolio ? (
            <Link
              href="/import-mutual-funds"
              className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
            >
              Upload Holdings
            </Link>
          ) : (
            <button
              onClick={() => loadDashboard()}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              Try Again
            </button>
          )
        }
      />
    );
  }

  if (!dashboard) {
    return null;
  }

  const { summary, risk_metrics: riskMetrics, performance_chart: performanceChart, sector_allocation: sectorAllocation, holdings, fundamentals, market_commentary: marketCommentary, data_gaps: dataGaps } = dashboard;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_35%),rgba(15,23,42,0.92)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.32em] text-teal-300">Portfolio View</div>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{dashboard.portfolio.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Decision-focused portfolio cockpit with risk, valuation, growth forecast, promoter holding context, and benchmark-aware commentary.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshMarketData}
              disabled={refreshing}
              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Refreshing Market Data...' : 'Refresh Market Data'}
            </button>
            <Link
              href="/import-mutual-funds"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
            >
              Import Another File
            </Link>
          </div>
        </div>
        {error ? <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div> : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
        <SummaryTile label="Total Value" value={formatCurrency(summary.total_value)} detail={`${holdings.length} holdings in view`} />
        <SummaryTile
          label="Today's P&L"
          value={formatCurrency(summary.todays_pnl)}
          detail={formatPercent(summary.todays_pnl_pct)}
          toneClass={metricTone(summary.todays_pnl)}
        />
        <SummaryTile
          label="Total Return"
          value={formatCurrency(summary.total_return)}
          detail={formatPercent(summary.total_return_pct)}
          toneClass={metricTone(summary.total_return)}
        />
        <SummaryTile
          label="XIRR"
          value={summary.xirr === null ? 'Needs cash flows' : formatPercent(summary.xirr)}
          detail="Time-weighted annualized return"
          toneClass={summary.xirr === null ? 'text-amber-300' : metricTone(summary.xirr)}
        />
        <SummaryTile
          label={`Alpha Vs ${getIndexName(selectedIndices[0] || '^NSEI')}`}
          value={formatPercent(summary.alpha_vs_benchmark)}
          detail={`12M portfolio ${formatPercent(summary.portfolio_return_12m)} vs benchmark ${formatPercent(summary.benchmark_return_12m)}`}
          toneClass={metricTone(summary.alpha_vs_benchmark)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="min-w-0 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-100">Performance Chart</h3>
              <p className="mt-2 text-sm text-slate-400">Rolling 12-month portfolio return versus selected indices.</p>
            </div>
            
            {/* Index Selection */}
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2 px-1">
                <span className="pr-1 text-sm text-slate-400">Compare with:</span>
                {INDEX_OPTIONS.map((index) => (
                  <button
                    key={index.ticker}
                    onClick={() => handleIndexToggle(index.ticker)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedIndices.includes(index.ticker)
                        ? 'bg-blue-600 text-white ring-1 ring-blue-500'
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                    }`}
                  >
                    {index.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-6 h-[340px] sm:h-80">
            {performanceChart.length === 0 ? (
              <EmptyState
                title="Performance history unavailable"
                description="Market price history is missing for one or more holdings, so the benchmark comparison cannot be reconstructed yet."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceChart}>
                  <XAxis dataKey="date" minTickGap={36} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value === null || value === undefined ? 'N/A' : `${value.toFixed(2)}%`,
                      name === 'portfolio' ? 'Portfolio' : getIndexName(name)
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#f59e0b" strokeWidth={3} dot={false} />
                  {selectedIndices.map((index) => (
                    <Line
                      key={index}
                      type="monotone"
                      dataKey={index}
                      name={getIndexName(index)}
                      stroke={getIndexColor(index)}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="rounded-2xl p-5 sm:p-6">
            <h3 className="text-xl font-semibold text-slate-100">Risk Metrics</h3>
            <p className="mt-2 text-sm text-slate-400">How efficiently return is being earned relative to risk.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <SummaryTile label="Beta" value={formatNumber(riskMetrics.beta)} />
              <SummaryTile label="Sharpe Ratio" value={formatNumber(riskMetrics.sharpe_ratio)} />
              <SummaryTile label="Max Drawdown" value={formatPercent(riskMetrics.max_drawdown)} toneClass="text-rose-300" />
              <SummaryTile label="1-Day VaR" value={formatCurrency(riskMetrics.value_at_risk_1d)} />
              <SummaryTile label="Annualized Volatility" value={formatPercent(riskMetrics.annualized_volatility)} />
              <SummaryTile label="Top-3 Concentration" value={formatPercent(riskMetrics.top_3_concentration)} />
            </div>
          </Card>

          <Card className="rounded-2xl p-5 sm:p-6">
            <h3 className="text-xl font-semibold text-slate-100">Sector Allocation</h3>
            <p className="mt-2 text-sm text-slate-400">Over-concentration check for rebalancing and risk control.</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(220px,1.05fr)] lg:items-center">
              <div className="h-60 min-w-0">
                {sectorAllocation.length === 0 ? (
                  <EmptyState title="No sector data" description="Sector classification will appear once market data is available." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sectorAllocation} dataKey="weight" nameKey="name" innerRadius={60} outerRadius={92} paddingAngle={3}>
                        {sectorAllocation.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value === null || value === undefined ? 'N/A' : `${value.toFixed(2)}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-3">
                {sectorAllocation.slice(0, 6).map((sector, index) => (
                  <div key={sector.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                      <span className="truncate text-sm text-slate-200">{sector.name}</span>
                    </div>
                    <span className="text-sm text-slate-400">{formatPercent(sector.weight)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card className="min-w-0 rounded-2xl p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-slate-100">Valuation, Growth, And Promoter Pulse</h3>
          <p className="mt-2 text-sm text-slate-400">Weighted portfolio fundamentals using current PE and forecast future PE.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <SummaryTile label="Current PE" value={formatMultiple(fundamentals.portfolio_pe)} />
            <SummaryTile label="Future PE" value={formatMultiple(fundamentals.portfolio_forward_pe)} />
            <SummaryTile label="Price / Book" value={formatMultiple(fundamentals.portfolio_price_to_book)} />
            <SummaryTile label="Dividend Yield" value={formatPercent(fundamentals.portfolio_dividend_yield)} />
            <SummaryTile label="EPS Growth" value={formatPercent(fundamentals.portfolio_eps_growth)} />
            <SummaryTile label="Revenue Growth" value={formatPercent(fundamentals.portfolio_revenue_growth)} />
            <SummaryTile label="Promoter Holding" value={formatPercent(fundamentals.portfolio_promoter_holding)} />
            <SummaryTile label="Analyst Coverage" value={`${fundamentals.analyst_coverage_count}`} detail={`${fundamentals.market_value_covered_pct.toFixed(2)}% market value covered`} />
            <SummaryTile label="Signals" value={`${fundamentals.buy_signal_count} buy / ${fundamentals.sell_signal_count} sell`} />
          </div>
        </Card>

        <Card className="rounded-2xl p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-slate-100">Market Commentary</h3>
          <p className="mt-2 text-sm text-slate-400">Wealth-manager lens on alpha, concentration, and near-term actions.</p>
          <div className="mt-6 space-y-3">
            {marketCommentary.map((comment, index) => (
              <div key={`${comment}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                {comment}
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Information You Can Add</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {dataGaps.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl p-5 sm:p-6">
        <h3 className="text-xl font-semibold text-slate-100">Holdings Table</h3>
        <p className="mt-2 text-sm text-slate-400">
          Price context, sizing, valuation, growth forecast, promoter holding, momentum, and synthesized BUY / HOLD / SELL view.
        </p>
        <div className="mt-6 grid gap-4 xl:hidden">
          {holdings.map((holding) => (
            <HoldingCard key={`${holding.symbol}-${holding.name}`} holding={holding} />
          ))}
        </div>
        <div className="mt-6 hidden overflow-x-auto xl:block">
          <table className="min-w-[1500px] divide-y divide-slate-800 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-3 py-3">Holding</th>
                <th className="px-3 py-3">Price / Day</th>
                <th className="px-3 py-3">Market Value / Weight</th>
                <th className="px-3 py-3">Total Return</th>
                <th className="px-3 py-3">Current PE</th>
                <th className="px-3 py-3">Future PE</th>
                <th className="px-3 py-3">P/B</th>
                <th className="px-3 py-3">Dividend Yield</th>
                <th className="px-3 py-3">Analyst Target</th>
                <th className="px-3 py-3">52W Range</th>
                <th className="px-3 py-3">RSI</th>
                <th className="px-3 py-3">Beta</th>
                <th className="px-3 py-3">Promoter Holding</th>
                <th className="px-3 py-3">EPS Growth</th>
                <th className="px-3 py-3">Revenue Growth</th>
                <th className="px-3 py-3">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/80">
              {holdings.map((holding) => (
                <tr key={holding.symbol} className="align-top text-slate-200">
                  <td className="px-3 py-4">
                    <div className="font-medium text-slate-100">{holding.symbol}</div>
                    <div className="mt-1 text-xs text-slate-400">{holding.name}</div>
                    <div className="mt-2 text-xs text-slate-500">{holding.sector || 'Unclassified'}</div>
                  </td>
                  <td className="px-3 py-4">
                    <div>{formatCurrency(holding.price)}</div>
                    <div className={`mt-1 text-xs ${metricTone(holding.day_change_pct)}`}>{formatPercent(holding.day_change_pct)}</div>
                  </td>
                  <td className="px-3 py-4">
                    <div>{formatCurrency(holding.market_value)}</div>
                    <div className="mt-1 text-xs text-slate-400">{formatPercent(holding.weight)}</div>
                  </td>
                  <td className={`px-3 py-4 ${metricTone(holding.total_return_pct)}`}>{formatPercent(holding.total_return_pct)}</td>
                  <td className="px-3 py-4">{formatMultiple(holding.pe_ratio)}</td>
                  <td className="px-3 py-4">{formatMultiple(holding.forward_pe)}</td>
                  <td className="px-3 py-4">{formatMultiple(holding.price_to_book)}</td>
                  <td className="px-3 py-4">{formatPercent(holding.dividend_yield)}</td>
                  <td className="px-3 py-4">
                    <div>{formatCurrency(holding.target_price)}</div>
                    <div className={`mt-1 text-xs ${metricTone(holding.upside_pct)}`}>{formatPercent(holding.upside_pct)}</div>
                  </td>
                  <td className="px-3 py-4">
                    <RangeBar position={holding.range_position} />
                    <div className="mt-1 text-xs text-slate-500">
                      Low {formatCurrency(holding.low_52w)} / High {formatCurrency(holding.high_52w)}
                    </div>
                  </td>
                  <td className="px-3 py-4">{formatNumber(holding.rsi)}</td>
                  <td className="px-3 py-4">{formatNumber(holding.beta)}</td>
                  <td className="px-3 py-4">{formatPercent(holding.promoter_holding)}</td>
                  <td className="px-3 py-4">{formatPercent(holding.eps_growth)}</td>
                  <td className="px-3 py-4">{formatPercent(holding.revenue_growth)}</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${signalClasses(holding.signal)}`}>
                      {holding.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
