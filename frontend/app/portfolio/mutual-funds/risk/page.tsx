'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MFNavTabs from '@/components/mf/MFNavTabs';
import { useMFPortfolioId, fetchMFAnalysis } from '@/lib/mf';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

function tone(v: number | null) {
  if (v == null) return 'text-slate-400';
  return v >= 0 ? 'text-emerald-400' : 'text-rose-400';
}

function pct(v: number | null | undefined, digits = 2) {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

interface FundRisk {
  fund_name: string;
  category: string;
  weight_pct: number;
  current_value: number;
  sharpe_ratio: number | null;
  std_dev_1y: number | null;
  max_drawdown: number | null;
  beta: number | null;
}

interface RiskData {
  portfolio_weighted_sharpe: number | null;
  portfolio_weighted_std_dev: number | null;
  portfolio_weighted_max_drawdown: number | null;
  portfolio_weighted_beta: number | null;
  num_categories: number;
  num_fund_houses: number;
  num_funds: number;
  hhi: number;
  concentration_label: string;
  category_diversification: boolean;
  has_risk_data: boolean;
  fund_risk_metrics: FundRisk[];
}

function MetricCard({
  label,
  value,
  sub,
  interpret,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  interpret?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${valueClass ?? 'text-white'}`}>{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
      {interpret && <div className="mt-2 text-xs text-slate-500 italic">{interpret}</div>}
    </div>
  );
}


export default function RiskPage() {
  const { portfolioId, loading: pidLoading, empty, error: pidError } = useMFPortfolioId();
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncAttempted = useRef(false);

  const fetchRiskData = (pid: number) =>
    fetchMFAnalysis<RiskData>(
      `/api/mutual-funds/portfolio/${pid}/risk-overview`,
      getAuthHeaders() as HeadersInit,
    );

  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    fetchRiskData(portfolioId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  // Auto-sync fund risk metrics when they are missing
  useEffect(() => {
    if (!portfolioId || !data || data.has_risk_data || syncAttempted.current) return;
    syncAttempted.current = true;
    setSyncing(true);
    fetch(apiUrl('/api/mutual-funds/sync/fund-data'), {
      method: 'POST',
      headers: getAuthHeaders() as HeadersInit,
    })
      .then(() => fetchRiskData(portfolioId))
      .then(setData)
      .catch(() => { /* silently ignore sync failures */ })
      .finally(() => setSyncing(false));
  }, [data, portfolioId]);

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
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 text-3xl">
                📂
              </div>
              <h3 className="text-lg font-semibold text-slate-200">No mutual fund holdings yet</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">Import your holdings to see Sharpe ratio, volatility, drawdown, and concentration risk.</p>
              <Link
                href="/import?type=holdings"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
              >
                Import Holdings
              </Link>
            </div>
          )}

          {!isLoading && (error || pidError) && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 text-3xl">
                📂
              </div>
              <h3 className="text-lg font-semibold text-slate-200">No mutual fund holdings yet</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">Import your holdings to see Sharpe ratio, volatility, drawdown, and concentration risk.</p>
              <Link
                href="/import?type=holdings"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
              >
                Import Holdings
              </Link>
            </div>
          )}

          {!isLoading && data && (
            <div className="space-y-6">
              {/* Diversification overview */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">Concentration Risk</div>
                  <div className={`mt-2 text-2xl font-bold ${
                    data.concentration_label === 'Low' ? 'text-emerald-400' :
                    data.concentration_label === 'Moderate' ? 'text-amber-400' : 'text-rose-400'
                  }`}>{data.concentration_label}</div>
                  <div className="mt-1 text-sm text-slate-400">HHI: {data.hhi} / 10000</div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        data.concentration_label === 'Low' ? 'bg-emerald-500' :
                        data.concentration_label === 'Moderate' ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min((data.hhi / 10000) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">&lt;1500 Low · 1500–2500 Moderate · &gt;2500 High</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">Category Diversification</div>
                  <div className={`mt-2 text-2xl font-bold ${data.category_diversification ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {data.category_diversification ? 'Diversified' : 'Concentrated'}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {data.num_categories} categor{data.num_categories === 1 ? 'y' : 'ies'} · {data.num_fund_houses} AMC{data.num_fund_houses !== 1 ? 's' : ''}
                  </div>
                  {!data.category_diversification && (
                    <p className="mt-2 text-xs text-amber-400/80">
                      Consider adding funds from different categories to reduce category-specific risk.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">Portfolio Size</div>
                  <div className="mt-2 text-2xl font-bold text-white">{data.num_funds} funds</div>
                  <div className="mt-1 text-sm text-slate-400">across {data.num_fund_houses} fund houses</div>
                  {data.num_funds > 10 && (
                    <p className="mt-2 text-xs text-amber-400/80">
                      Over-diversification can dilute returns. Consider consolidating similar funds.
                    </p>
                  )}
                </div>
              </div>

              {/* Weighted risk metrics */}
              {data.has_risk_data ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Weighted Sharpe Ratio"
                      value={data.portfolio_weighted_sharpe != null ? data.portfolio_weighted_sharpe.toFixed(2) : '—'}
                      interpret="&gt;1.0 is good · &gt;2.0 is excellent"
                      valueClass={data.portfolio_weighted_sharpe != null && data.portfolio_weighted_sharpe >= 1 ? 'text-emerald-400' : 'text-amber-400'}
                    />
                    <MetricCard
                      label="Weighted Std Dev (1Y)"
                      value={data.portfolio_weighted_std_dev != null ? `${data.portfolio_weighted_std_dev.toFixed(1)}%` : '—'}
                      interpret="Annualised volatility"
                      valueClass="text-amber-400"
                    />
                    <MetricCard
                      label="Weighted Max Drawdown"
                      value={data.portfolio_weighted_max_drawdown != null ? `${data.portfolio_weighted_max_drawdown.toFixed(1)}%` : '—'}
                      interpret="Largest peak-to-trough fall"
                      valueClass="text-rose-400"
                    />
                    <MetricCard
                      label="Weighted Beta"
                      value={data.portfolio_weighted_beta != null ? data.portfolio_weighted_beta.toFixed(2) : '—'}
                      interpret="Sensitivity vs benchmark (&lt;1 = lower risk)"
                      valueClass={data.portfolio_weighted_beta != null && data.portfolio_weighted_beta < 1 ? 'text-emerald-400' : 'text-amber-400'}
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                    <span className="font-medium text-slate-200">Reading guide: </span>
                    Sharpe &gt;1 = good risk-adjusted returns ·
                    Std Dev &lt;15% = moderate volatility ·
                    Beta &lt;1 = less volatile than market ·
                    Max Drawdown = worst case loss from peak
                  </div>
                </>
              ) : syncing ? (
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-6 text-center">
                  <div className="flex items-center justify-center gap-3 text-sky-400">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    <span className="font-medium">Fetching fund risk metrics…</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Pulling NAV history from MFAPI and computing Sharpe ratio, volatility, and drawdown. This takes a few seconds.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-400">
                  <div className="text-2xl mb-2">📊</div>
                  <p className="font-medium text-slate-300">Risk Metrics Unavailable</p>
                  <p className="mt-1 text-sm">
                    Could not retrieve quantitative risk data from MFAPI for your funds. This may be due to a network issue or unrecognised fund names.
                  </p>
                </div>
              )}

              {/* Per-fund risk table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Fund-level Risk Metrics</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                        <th className="pb-3 pr-4">Fund</th>
                        <th className="pb-3 pr-4 text-right">Weight</th>
                        <th className="pb-3 pr-4 text-right">Sharpe</th>
                        <th className="pb-3 pr-4 text-right">Std Dev</th>
                        <th className="pb-3 pr-4 text-right">Max DD</th>
                        <th className="pb-3 text-right">Beta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.fund_risk_metrics.map((f, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="py-3 pr-4">
                            <div className="max-w-xs truncate font-medium text-slate-100">{f.fund_name}</div>
                            <div className="text-xs text-slate-500">{f.category}</div>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(f.weight_pct, 100)}%` }} />
                              </div>
                              <span className="text-slate-300">{f.weight_pct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-300">
                            {f.sharpe_ratio != null ? f.sharpe_ratio.toFixed(2) : '—'}
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-300">
                            {f.std_dev_1y != null ? `${f.std_dev_1y.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3 pr-4 text-right text-rose-400">
                            {f.max_drawdown != null ? `${f.max_drawdown.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3 text-right text-slate-300">
                            {f.beta != null ? f.beta.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Data-source footnote */}
                <p className="mt-3 text-xs text-slate-600">
                  Expense ratio and star ratings are not shown — they are not available from the free mfapi.in data source. For TER and ratings, visit{' '}
                  <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">amfiindia.com</a>{' '}
                  or{' '}
                  <a href="https://www.valueresearchonline.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">valueresearchonline.com</a>.
                </p>
              </div>


            </div>
          )}
    </div>
  );
}
