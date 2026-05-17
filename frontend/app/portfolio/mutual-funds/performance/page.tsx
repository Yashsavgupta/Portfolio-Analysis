'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MFNavTabs from '@/components/mf/MFNavTabs';
import { useMFPortfolioId, fetchMFAnalysis } from '@/lib/mf';
import { getAuthHeaders } from '@/lib/auth';

function fmt(v: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v);
}

function tone(v: number | null | undefined) {
  if (v == null) return 'text-slate-300';
  return v >= 0 ? 'text-emerald-400' : 'text-rose-400';
}

function pct(v: number | null | undefined, digits = 2) {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

function days(d: number) {
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}m`;
  return `${(d / 365).toFixed(1)}y`;
}

interface FundPerf {
  holding_id: number;
  fund_name: string;
  fund_house: string;
  category: string;
  plan_type: string;
  purchase_date: string;
  holding_days: number;
  is_long_term: boolean;
  invested: number;
  current_value: number;
  gain_loss: number;
  gain_loss_pct: number;
  cagr: number | null;
  fund_1y_return: number | null;
  fund_3y_return: number | null;
  fund_5y_return: number | null;
}

interface PerfData {
  portfolio_xirr: number | null;
  portfolio_cagr: number | null;
  absolute_return_pct: number;
  total_invested: number;
  total_current_value: number;
  total_gain_loss: number;
  total_holding_days: number;
  num_funds: number;
  fund_performance: FundPerf[];
  best_performers: FundPerf[];
  worst_performers: FundPerf[];
}

function MetricCard({ label, value, sub, valueClass = 'text-white' }: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
    </div>
  );
}

function PerfRow({ f }: { f: FundPerf }) {
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/40">
      <td className="py-3 pr-4">
        <div className="max-w-xs truncate font-medium text-slate-100">{f.fund_name}</div>
        <div className="text-xs text-slate-500">{f.fund_house} · {f.category}</div>
      </td>
      <td className="py-3 pr-4 text-slate-400 text-sm">{days(f.holding_days)}</td>
      <td className="py-3 pr-4 text-right text-slate-400">{fmt(f.invested)}</td>
      <td className="py-3 pr-4 text-right text-slate-200">{fmt(f.current_value)}</td>
      <td className={`py-3 pr-4 text-right font-medium ${tone(f.gain_loss)}`}>
        {f.gain_loss >= 0 ? '+' : ''}{fmt(f.gain_loss)}
      </td>
      <td className={`py-3 pr-4 text-right font-medium ${tone(f.gain_loss_pct)}`}>
        {pct(f.gain_loss_pct)}
      </td>
      <td className={`py-3 pr-4 text-right font-semibold ${tone(f.cagr)}`}>
        {f.cagr != null ? pct(f.cagr) : '—'}
      </td>
      <td className={`py-3 pr-4 text-right text-sm ${tone(f.fund_1y_return)}`}>
        {pct(f.fund_1y_return)}
      </td>
      <td className={`py-3 text-right text-sm ${tone(f.fund_3y_return)}`}>
        {pct(f.fund_3y_return)}
      </td>
    </tr>
  );
}

export default function PerformancePage() {
  const { portfolioId, loading: pidLoading, empty, error: pidError } = useMFPortfolioId();
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    fetchMFAnalysis<PerfData>(
      `/api/mutual-funds/portfolio/${portfolioId}/xirr-performance`,
      getAuthHeaders() as HeadersInit,
    )
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  const isLoading = pidLoading || loading;

  return (
    <div>
      <MFNavTabs />

          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-800" />)}
            </div>
          )}

          {!isLoading && empty && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-10 text-center">
              <p className="text-slate-400">No mutual fund holdings yet.</p>
              <Link href="/import?type=holdings" className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition">
                Import Funds
              </Link>
            </div>
          )}

          {!isLoading && (error || pidError) && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error || pidError}</div>
          )}

          {!isLoading && data && (
            <div className="space-y-6">
              {/* XIRR Hero */}
              <div className="rounded-2xl border border-slate-800 bg-[radial-gradient(ellipse_at_top_left,rgba(20,184,166,0.15),transparent_50%)] p-6">
                <div className="text-xs uppercase tracking-widest text-teal-400">Portfolio XIRR</div>
                <div className={`mt-2 text-5xl font-bold ${tone(data.portfolio_xirr)}`}>
                  {data.portfolio_xirr != null ? `${data.portfolio_xirr >= 0 ? '+' : ''}${data.portfolio_xirr.toFixed(2)}%` : '—'}
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Annualised return accounting for actual timing of investments (XIRR). Invested over {days(data.total_holding_days)}.
                </p>
              </div>

              {/* Key metrics */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Total Gain / Loss"
                  value={fmt(data.total_gain_loss)}
                  sub={`${pct(data.absolute_return_pct)} absolute`}
                  valueClass={tone(data.total_gain_loss)}
                />
                <MetricCard
                  label="CAGR"
                  value={pct(data.portfolio_cagr)}
                  sub="Compounded annual growth"
                  valueClass={tone(data.portfolio_cagr)}
                />
                <MetricCard label="Total Invested" value={fmt(data.total_invested)} />
                <MetricCard
                  label="Current Value"
                  value={fmt(data.total_current_value)}
                  sub={`${data.num_funds} holdings`}
                />
              </div>

              {/* Best / Worst */}
              <div className="grid gap-4 sm:grid-cols-2">
                {data.best_performers.length > 0 && (
                  <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5">
                    <h3 className="mb-3 text-sm font-semibold text-emerald-400 uppercase tracking-widest">Best Performers</h3>
                    <div className="space-y-2">
                      {data.best_performers.map((f) => (
                        <div key={f.holding_id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-100">{f.fund_name}</div>
                            <div className="text-xs text-slate-500">{f.category}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-semibold text-emerald-400">{pct(f.cagr)} CAGR</div>
                            <div className="text-xs text-slate-500">{pct(f.gain_loss_pct)} abs</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.worst_performers.length > 0 && (
                  <div className="rounded-2xl border border-rose-800/40 bg-rose-950/20 p-5">
                    <h3 className="mb-3 text-sm font-semibold text-rose-400 uppercase tracking-widest">Underperformers</h3>
                    <div className="space-y-2">
                      {data.worst_performers.map((f) => (
                        <div key={f.holding_id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-100">{f.fund_name}</div>
                            <div className="text-xs text-slate-500">{f.category}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className={`font-semibold ${tone(f.cagr)}`}>{pct(f.cagr)} CAGR</div>
                            <div className="text-xs text-slate-500">{pct(f.gain_loss_pct)} abs</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Full fund table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Fund-wise Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                        <th className="pb-3 pr-4">Fund</th>
                        <th className="pb-3 pr-4">Tenure</th>
                        <th className="pb-3 pr-4 text-right">Invested</th>
                        <th className="pb-3 pr-4 text-right">Current</th>
                        <th className="pb-3 pr-4 text-right">Gain/Loss</th>
                        <th className="pb-3 pr-4 text-right">Abs%</th>
                        <th className="pb-3 pr-4 text-right">Your CAGR</th>
                        <th className="pb-3 pr-4 text-right">Fund 1Y</th>
                        <th className="pb-3 text-right">Fund 3Y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fund_performance.map((f) => (
                        <PerfRow key={f.holding_id} f={f} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  "Fund 1Y / 3Y" = fund's published trailing returns, independent of your purchase timing.
                  "Your CAGR" = your actual annualised return based on cost basis and holding period.
                </p>
              </div>
            </div>
          )}
    </div>
  );
}
