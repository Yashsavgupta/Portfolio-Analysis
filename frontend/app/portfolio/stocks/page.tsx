'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { apiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';

type NullableNumber = number | null;

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

interface SectorAllocation {
  name: string;
  value: number;
  weight: number;
}

interface PortfolioDashboardResponse {
  holdings: HoldingRow[];
  sector_allocation: SectorAllocation[];
}

const SECTOR_COLORS = ['#14b8a6', '#38bdf8', '#f59e0b', '#f97316', '#ef4444', '#a78bfa', '#84cc16', '#e879f9'];

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

function StatCard({
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
      {detail ? <div className="mt-2 text-sm text-slate-400">{detail}</div> : <div className="mt-2 text-sm text-transparent">.</div>}
    </div>
  );
}

function StockHoldingCard({ holding }: { holding: HoldingRow }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-100">{holding.symbol}</div>
          <div className="mt-1 text-sm text-slate-300">{holding.name}</div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{holding.sector || 'Unclassified'}</div>
        </div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${signalClasses(holding.signal)}`}>
          {holding.signal}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Price" value={formatCurrency(holding.price)} detail={`Prev close ${formatCurrency(holding.previous_close)}`} />
        <StatCard
          label="Day Move"
          value={formatCurrency(holding.day_pnl)}
          detail={formatPercent(holding.day_change_pct)}
          toneClass={metricTone(holding.day_pnl)}
        />
        <StatCard label="Value" value={formatCurrency(holding.market_value)} detail={`Weight ${formatPercent(holding.weight)}`} />
        <StatCard
          label="Total Return"
          value={formatPercent(holding.total_return_pct)}
          detail={`Target ${formatPercent(holding.upside_pct)}`}
          toneClass={metricTone(holding.total_return_pct)}
        />
        <StatCard label="Current PE" value={formatMultiple(holding.pe_ratio)} detail={`Forward ${formatMultiple(holding.forward_pe)}`} />
        <StatCard label="Growth" value={formatPercent(holding.eps_growth)} detail={`Revenue ${formatPercent(holding.revenue_growth)}`} />
      </div>
    </div>
  );
}

export default function StockPortfolioPage() {
  const [dashboard, setDashboard] = useState<PortfolioDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(apiUrl('/api/portfolios/dashboard'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Failed to load portfolio dashboard');
      }
      setDashboard(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio dashboard');
    } finally {
      setLoading(false);
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
    return (
      <EmptyState
        title="Portfolio Error"
        description={error}
        action={
          <button
            onClick={() => fetchDashboard()}
            className="rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            Try Again
          </button>
        }
      />
    );
  }

  if (!dashboard) {
    return null;
  }

  const stockHoldings = dashboard.holdings.filter((holding) => holding.asset_type?.toLowerCase() === 'stock');

  if (stockHoldings.length === 0) {
    return (
      <EmptyState
        title="No Stock Holdings"
        description="Your portfolio does not contain any stock holdings."
        action={
          <Link
            href="/import-mutual-funds"
            className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Upload Holdings
          </Link>
        }
      />
    );
  }

  const totalStockValue = stockHoldings.reduce((sum, h) => sum + h.market_value, 0);
  const totalStockInvested = stockHoldings.reduce((sum, h) => sum + h.invested_value, 0);
  const totalStockReturn = totalStockValue - totalStockInvested;
  const totalStockPreviousValue = stockHoldings.reduce((sum, h) => sum + h.previous_value, 0);
  const totalStockDayPnl = stockHoldings.reduce((sum, h) => sum + h.day_pnl, 0);
  const totalStockDayChangePct = totalStockPreviousValue > 0 ? (totalStockDayPnl / totalStockPreviousValue) * 100 : 0;
  const buySignals = stockHoldings.filter((holding) => holding.signal === 'BUY').length;
  const sellSignals = stockHoldings.filter((holding) => holding.signal === 'SELL').length;
  const recalculatedStockSectors: SectorAllocation[] = Object.values(
    stockHoldings.reduce<Record<string, SectorAllocation>>((acc, holding) => {
      const name = holding.sector || 'Others';
      if (!acc[name]) {
        acc[name] = { name, value: 0, weight: 0 };
      }
      acc[name].value += holding.market_value;
      return acc;
    }, {})
  )
    .map((sector) => ({
      ...sector,
      value: Number(sector.value.toFixed(2)),
      weight: Number(((sector.value / totalStockValue) * 100 || 0).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.14),_transparent_30%),rgba(15,23,42,0.92)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] text-sky-300">Equity Book</div>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Equity Positions</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Equity-only view for concentration, sector balance, valuation, and signal-driven position review.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[320px]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sectors</div>
              <div className="mt-2 text-lg font-semibold text-slate-100">{recalculatedStockSectors.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Buy Signals</div>
              <div className="mt-2 text-lg font-semibold text-emerald-300">{buySignals}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sell Signals</div>
              <div className="mt-2 text-lg font-semibold text-rose-300">{sellSignals}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Total Stock Value" value={formatCurrency(totalStockValue)} detail={`${stockHoldings.length} holdings`} />
        <StatCard
          label="Total Return"
          value={formatCurrency(totalStockReturn)}
          detail={formatPercent(totalStockInvested > 0 ? (totalStockReturn / totalStockInvested) * 100 : 0)}
          toneClass={metricTone(totalStockReturn)}
        />
        <StatCard
          label="Daily Change"
          value={formatPercent(totalStockDayChangePct)}
          detail={formatCurrency(totalStockDayPnl)}
          toneClass={metricTone(totalStockDayPnl)}
        />
        <StatCard
          label="Largest Sector"
          value={recalculatedStockSectors[0]?.name ?? 'N/A'}
          detail={recalculatedStockSectors[0] ? formatPercent(recalculatedStockSectors[0].weight) : 'No sector data'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px]">
        <Card className="min-w-0 rounded-2xl p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-slate-100">Sector Allocation</h3>
          <p className="mt-2 text-sm text-slate-400">Stock-only sector weighting recalculated from the equity book.</p>

          {recalculatedStockSectors.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
              <div className="h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={recalculatedStockSectors}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={112}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {recalculatedStockSectors.map((entry, index) => (
                        <Cell key={`cell-${entry.name}-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {recalculatedStockSectors.slice(0, 6).map((sector, index) => (
                  <div key={sector.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SECTOR_COLORS[index % SECTOR_COLORS.length] }} />
                      <span className="truncate text-sm text-slate-200">{sector.name}</span>
                    </div>
                    <span className="text-sm text-slate-400">{formatPercent(sector.weight)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState title="No sector data" description="Sector allocation will appear once stock market data is available." />
            </div>
          )}
        </Card>

        <Card className="rounded-2xl p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-slate-100">Position Pulse</h3>
          <p className="mt-2 text-sm text-slate-400">Quick look at the heaviest holdings and overall signal balance.</p>
          <div className="mt-6 space-y-3">
            {stockHoldings.slice(0, 5).map((holding) => (
              <div key={`${holding.symbol}-${holding.name}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{holding.symbol}</div>
                    <div className="mt-1 text-xs text-slate-400">{holding.sector || 'Unclassified'}</div>
                  </div>
                  <span className="text-sm text-slate-300">{formatPercent(holding.weight)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className={`text-sm font-medium ${metricTone(holding.total_return_pct)}`}>{formatPercent(holding.total_return_pct)}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${signalClasses(holding.signal)}`}>
                    {holding.signal}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl p-5 sm:p-6">
        <h3 className="text-xl font-semibold text-slate-100">Stock Holdings</h3>
        <p className="mt-2 text-sm text-slate-400">Value, daily move, sector role, return, valuation, and signal for each equity position.</p>

        <div className="mt-6 grid gap-4 xl:hidden">
          {stockHoldings.map((holding) => (
            <StockHoldingCard key={`${holding.symbol}-${holding.name}`} holding={holding} />
          ))}
        </div>

        <div className="mt-6 hidden overflow-x-auto xl:block">
          <table className="min-w-[1000px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-3">Holding</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Day Change</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Weight</th>
                <th className="px-4 py-3 text-right">Return</th>
                <th className="px-4 py-3 text-right">PE</th>
                <th className="px-4 py-3 text-right">Target</th>
                <th className="px-4 py-3 text-right">Signal</th>
              </tr>
            </thead>
            <tbody>
              {stockHoldings.map((holding, idx) => (
                <tr key={`${holding.symbol}-${idx}`} className="border-b border-slate-800 align-top hover:bg-slate-800/40">
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-100">{holding.symbol}</div>
                    <div className="mt-1 text-sm text-slate-300">{holding.name}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{holding.sector || 'Unclassified'}</div>
                  </td>
                  <td className="px-4 py-4 text-right text-slate-300">{formatCurrency(holding.price)}</td>
                  <td className={`px-4 py-4 text-right font-medium ${metricTone(holding.day_change_pct)}`}>
                    <div>{formatPercent(holding.day_change_pct)}</div>
                    <div className="mt-1 text-xs">{formatCurrency(holding.day_pnl)}</div>
                  </td>
                  <td className="px-4 py-4 text-right text-slate-300">{formatCurrency(holding.market_value)}</td>
                  <td className="px-4 py-4 text-right text-slate-300">{formatPercent(holding.weight)}</td>
                  <td className={`px-4 py-4 text-right font-medium ${metricTone(holding.total_return_pct)}`}>
                    <div>{formatPercent(holding.total_return_pct)}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatCurrency(holding.invested_value)}</div>
                  </td>
                  <td className="px-4 py-4 text-right text-slate-300">
                    <div>{formatMultiple(holding.pe_ratio)}</div>
                    <div className="mt-1 text-xs text-slate-500">{`Fwd ${formatMultiple(holding.forward_pe)}`}</div>
                  </td>
                  <td className={`px-4 py-4 text-right font-medium ${metricTone(holding.upside_pct)}`}>
                    <div>{formatCurrency(holding.target_price)}</div>
                    <div className="mt-1 text-xs">{formatPercent(holding.upside_pct)}</div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${signalClasses(holding.signal)}`}>
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
