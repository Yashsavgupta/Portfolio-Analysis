'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { apiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';

type NullableNumber = number | null;

interface AssetSlice {
  name: string;
  value: number;
  weight: number;
}

interface AssetSummary {
  portfolio_id: number | null;
  portfolio_name: string | null;
  total_value: number;
  total_invested: number;
  total_return: number;
  total_return_pct: number;
  holdings_count: number;
}

interface CombinedSummary {
  stocks: AssetSummary;
  mutual_funds: AssetSummary;
  total: {
    total_value: number;
    total_invested: number;
    total_return: number;
    total_return_pct: number;
  };
  asset_allocation: AssetSlice[];
}

const ALLOCATION_COLORS: Record<string, string> = {
  Stocks: '#38bdf8',
  'Mutual Funds': '#14b8a6',
};

function fmt(value: NullableNumber) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function pct(value: NullableNumber, digits = 2) {
  if (value === null || value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function tone(value: NullableNumber) {
  if (!value) return 'text-slate-100';
  return value > 0 ? 'text-emerald-400' : 'text-rose-400';
}

function SummaryTile({ label, value, sub, toneClass = 'text-slate-100' }: { label: string; value: string; sub?: string; toneClass?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-2 text-sm text-slate-400">{sub}</div> : <div className="mt-2 text-sm text-transparent">.</div>}
    </div>
  );
}

function AssetCard({
  title,
  accent,
  data,
  href,
}: {
  title: string;
  accent: string;
  data: AssetSummary;
  href: string;
}) {
  const hasData = data.holdings_count > 0;
  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`text-xs uppercase tracking-[0.28em] ${accent}`}>{title}</div>
          <div className="mt-2 text-xl font-semibold text-white">{hasData ? fmt(data.total_value) : '—'}</div>
          {hasData && (
            <div className={`mt-1 text-sm font-medium ${tone(data.total_return)}`}>
              {fmt(data.total_return)} &nbsp;
              <span className="text-xs font-normal text-slate-400">({pct(data.total_return_pct)})</span>
            </div>
          )}
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
        >
          View details →
        </Link>
      </div>

      {hasData ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-900/70 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Invested</div>
            <div className="mt-1.5 text-sm font-semibold text-slate-200">{fmt(data.total_invested)}</div>
          </div>
          <div className="rounded-xl bg-slate-900/70 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Return</div>
            <div className={`mt-1.5 text-sm font-semibold ${tone(data.total_return_pct)}`}>{pct(data.total_return_pct)}</div>
          </div>
          <div className="rounded-xl bg-slate-900/70 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Holdings</div>
            <div className="mt-1.5 text-sm font-semibold text-slate-200">{data.holdings_count}</div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 px-4 py-5 text-center text-sm text-slate-500">
          No {title.toLowerCase()} imported yet.{' '}
          <Link href="/import-mutual-funds" className="text-sky-400 hover:text-sky-300">
            Import holdings
          </Link>
        </div>
      )}
    </Card>
  );
}

export default function TotalPortfolioPage() {
  const [summary, setSummary] = useState<CombinedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    fetch(apiUrl('/api/portfolios/combined-summary'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => setSummary(data))
      .catch(() => setError('Failed to load portfolio summary'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
        <LoadingSkeleton />
      </div>
    );
  }

  const hasAnyHoldings = summary && (summary.stocks.holdings_count > 0 || summary.mutual_funds.holdings_count > 0);

  if (error || !summary) {
    return (
      <EmptyState
        title="Portfolio Error"
        description={error || 'Could not load summary'}
        action={
          <Link href="/import-mutual-funds" className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20">
            Import Holdings
          </Link>
        }
      />
    );
  }

  if (!hasAnyHoldings) {
    return (
      <EmptyState
        title="Import Holdings To Start"
        description="Upload your Zerodha stock holdings or INDmoney mutual fund export to see your combined portfolio view."
        action={
          <Link href="/import-mutual-funds" className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20">
            Upload Holdings
          </Link>
        }
      />
    );
  }

  const { total, asset_allocation } = summary;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="overflow-hidden rounded-2xl border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_35%),rgba(15,23,42,0.92)] p-5 sm:p-6">
        <div className="text-xs uppercase tracking-[0.32em] text-teal-300">Combined View</div>
        <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Total Portfolio</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Aggregated view across all stocks and mutual funds. Click into each section for detailed analysis.
        </p>
      </Card>

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Total Value" value={fmt(total.total_value)} sub={`${summary.stocks.holdings_count + summary.mutual_funds.holdings_count} holdings`} />
        <SummaryTile label="Total Invested" value={fmt(total.total_invested)} />
        <SummaryTile
          label="Total Return"
          value={fmt(total.total_return)}
          sub={pct(total.total_return_pct)}
          toneClass={tone(total.total_return)}
        />
        <SummaryTile
          label="Return %"
          value={pct(total.total_return_pct)}
          toneClass={tone(total.total_return_pct)}
        />
      </div>

      {/* Asset allocation + asset cards */}
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Donut chart */}
        {asset_allocation.length > 0 && (
          <Card className="rounded-2xl p-5 sm:p-6">
            <h3 className="text-base font-semibold text-slate-100">Asset Allocation</h3>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={asset_allocation} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {asset_allocation.map((entry) => (
                      <Cell key={entry.name} fill={ALLOCATION_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {asset_allocation.map((slice) => (
                <div key={slice.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[slice.name] ?? '#94a3b8' }} />
                    <span className="text-sm text-slate-200">{slice.name}</span>
                  </div>
                  <span className="text-sm text-slate-400">{slice.weight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Per-asset cards */}
        <div className="space-y-4">
          <AssetCard title="Stocks" accent="text-sky-300" data={summary.stocks} href="/portfolio/stocks" />
          <AssetCard title="Mutual Funds" accent="text-teal-300" data={summary.mutual_funds} href="/portfolio/mutual-funds" />
        </div>
      </div>
    </div>
  );
}
