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

function tone(v: number) {
  return v >= 0 ? 'text-emerald-400' : 'text-rose-400';
}

interface HoldingRow {
  holding_id: number;
  fund_name: string;
  category: string;
  purchase_date: string;
  holding_days: number;
  invested: number;
  current_value: number;
  gain_loss: number;
  gain_loss_pct: number;
}

interface HarvestRow extends HoldingRow {
  potential_tax_saving: number;
}

interface UpcomingRow extends HoldingRow {
  days_to_ltcg: number;
}

interface TaxData {
  ltcg_equity: {
    total_gains: number;
    exempt_amount: number;
    taxable_gains: number;
    tax_rate: number;
    estimated_tax: number;
    holdings: HoldingRow[];
    holdings_count: number;
  };
  stcg_equity: {
    total_gains: number;
    tax_rate: number;
    estimated_tax: number;
    holdings: HoldingRow[];
    holdings_count: number;
  };
  debt_holdings: {
    count: number;
    note: string;
    holdings: HoldingRow[];
  };
  total_estimated_tax: number;
  tax_harvest_opportunities: HarvestRow[];
  upcoming_ltcg_eligibility: UpcomingRow[];
}

function TaxBucketCard({
  title,
  gains,
  tax,
  rate,
  count,
  accent,
  children,
}: {
  title: string;
  gains: number;
  tax: number;
  rate: number;
  count: number;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-6 ${accent}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">{title}</div>
          <div className={`mt-2 text-3xl font-bold ${gains >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmt(gains)}
          </div>
          <div className="mt-1 text-sm text-slate-400">{count} holding{count !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-right">
          <div className="text-xs text-slate-500">Est. Tax Liability</div>
          <div className="mt-1 text-lg font-bold text-rose-400">{fmt(tax)}</div>
          <div className="text-xs text-slate-500">@ {rate}%</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function HoldingsTable({ rows, cols }: {
  rows: HoldingRow[];
  cols?: { key: string; label: string; render: (r: HoldingRow) => React.ReactNode }[];
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No holdings in this bucket.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
            <th className="pb-2 pr-4">Fund</th>
            <th className="pb-2 pr-4 text-right">Invested</th>
            <th className="pb-2 pr-4 text-right">Current</th>
            <th className="pb-2 pr-4 text-right">Gain/Loss</th>
            <th className="pb-2 text-right">Return%</th>
            {cols?.map((c) => <th key={c.key} className="pb-2 pl-4 text-right">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((r) => (
            <tr key={r.holding_id} className="hover:bg-slate-800/30">
              <td className="py-2 pr-4">
                <div className="max-w-xs truncate font-medium text-slate-100">{r.fund_name}</div>
                <div className="text-xs text-slate-500">{r.category} · {r.holding_days}d held</div>
              </td>
              <td className="py-2 pr-4 text-right text-slate-400">{fmt(r.invested)}</td>
              <td className="py-2 pr-4 text-right text-slate-200">{fmt(r.current_value)}</td>
              <td className={`py-2 pr-4 text-right font-medium ${tone(r.gain_loss)}`}>{fmt(r.gain_loss)}</td>
              <td className={`py-2 text-right ${tone(r.gain_loss_pct)}`}>
                {r.gain_loss_pct >= 0 ? '+' : ''}{r.gain_loss_pct.toFixed(2)}%
              </td>
              {cols?.map((c) => <td key={c.key} className="py-2 pl-4 text-right">{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TaxPage() {
  const { portfolioId, loading: pidLoading, empty, error: pidError } = useMFPortfolioId();
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    fetchMFAnalysis<TaxData>(
      `/api/mutual-funds/portfolio/${portfolioId}/tax-deep-dive`,
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
              {[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-800" />)}
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
              {/* Total tax summary banner */}
              <div className="flex items-center justify-between rounded-2xl border border-rose-800/40 bg-rose-950/20 px-6 py-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-rose-400">Total Estimated Tax Liability (FY)</div>
                  <div className="mt-1 text-3xl font-bold text-rose-300">{fmt(data.total_estimated_tax)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Based on unrealised gains</div>
                  <div className="text-xs text-slate-500">Actual liability on redemption only</div>
                </div>
              </div>

              {/* Tax info banner */}
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                <span className="font-medium text-slate-200">2024-25 Tax Rates: </span>
                Equity LTCG (&gt;1yr): <strong className="text-slate-200">12.5%</strong> on gains above ₹1 lakh ·
                Equity STCG (≤1yr): <strong className="text-slate-200">20%</strong> ·
                Debt funds: <strong className="text-slate-200">income-tax slab rate</strong> (no indexation)
              </div>

              {/* LTCG card */}
              <TaxBucketCard
                title="Long-Term Capital Gains — Equity (>1 year)"
                gains={data.ltcg_equity.total_gains}
                tax={data.ltcg_equity.estimated_tax}
                rate={data.ltcg_equity.tax_rate}
                count={data.ltcg_equity.holdings_count}
                accent="border-emerald-800/30 bg-emerald-950/10"
              >
                {data.ltcg_equity.total_gains > 0 && data.ltcg_equity.taxable_gains <= 0 && (
                  <div className="mt-3 rounded-xl border border-emerald-700/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-300">
                    ✓ Your LTCG (₹{data.ltcg_equity.total_gains.toFixed(0)}) is within the ₹1 lakh annual exemption — no tax due.
                  </div>
                )}
                <button
                  className="mt-3 text-xs text-slate-400 hover:text-slate-200 transition"
                  onClick={() => setExpandedSection(expandedSection === 'ltcg' ? null : 'ltcg')}
                >
                  {expandedSection === 'ltcg' ? '▲ Hide' : '▼ Show'} holdings ({data.ltcg_equity.holdings_count})
                </button>
                {expandedSection === 'ltcg' && <HoldingsTable rows={data.ltcg_equity.holdings} />}
              </TaxBucketCard>

              {/* STCG card */}
              <TaxBucketCard
                title="Short-Term Capital Gains — Equity (≤1 year)"
                gains={data.stcg_equity.total_gains}
                tax={data.stcg_equity.estimated_tax}
                rate={data.stcg_equity.tax_rate}
                count={data.stcg_equity.holdings_count}
                accent="border-amber-800/30 bg-amber-950/10"
              >
                <button
                  className="mt-3 text-xs text-slate-400 hover:text-slate-200 transition"
                  onClick={() => setExpandedSection(expandedSection === 'stcg' ? null : 'stcg')}
                >
                  {expandedSection === 'stcg' ? '▲ Hide' : '▼ Show'} holdings ({data.stcg_equity.holdings_count})
                </button>
                {expandedSection === 'stcg' && <HoldingsTable rows={data.stcg_equity.holdings} />}
              </TaxBucketCard>

              {/* Debt holdings */}
              {data.debt_holdings.count > 0 && (
                <div className="rounded-2xl border border-sky-800/30 bg-sky-950/10 p-6">
                  <div className="text-xs uppercase tracking-widest text-sky-400">Debt / Other Fund Holdings</div>
                  <div className="mt-2 text-lg font-semibold text-white">{data.debt_holdings.count} holding{data.debt_holdings.count !== 1 ? 's' : ''}</div>
                  <p className="mt-2 text-sm text-slate-400">{data.debt_holdings.note}</p>
                  <button
                    className="mt-3 text-xs text-slate-400 hover:text-slate-200 transition"
                    onClick={() => setExpandedSection(expandedSection === 'debt' ? null : 'debt')}
                  >
                    {expandedSection === 'debt' ? '▲ Hide' : '▼ Show'} holdings ({data.debt_holdings.count})
                  </button>
                  {expandedSection === 'debt' && <HoldingsTable rows={data.debt_holdings.holdings} />}
                </div>
              )}

              {/* Upcoming LTCG eligibility */}
              {data.upcoming_ltcg_eligibility.length > 0 && (
                <div className="rounded-2xl border border-teal-800/30 bg-teal-950/10 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-teal-400">
                    Becoming Long-Term Within 60 Days
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Wait before redeeming — these become LTCG eligible soon, reducing your tax rate from 20% to 12.5%.
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                          <th className="pb-2 pr-4">Fund</th>
                          <th className="pb-2 pr-4 text-right">Days to LTCG</th>
                          <th className="pb-2 pr-4 text-right">Current Gain</th>
                          <th className="pb-2 text-right">STCG Tax Now</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {data.upcoming_ltcg_eligibility.map((r) => (
                          <tr key={r.holding_id} className="hover:bg-slate-800/30">
                            <td className="py-2 pr-4">
                              <div className="max-w-xs truncate font-medium text-slate-100">{r.fund_name}</div>
                            </td>
                            <td className="py-2 pr-4 text-right">
                              <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-300">
                                {r.days_to_ltcg}d
                              </span>
                            </td>
                            <td className={`py-2 pr-4 text-right font-medium ${tone(r.gain_loss)}`}>
                              {fmt(r.gain_loss)}
                            </td>
                            <td className="py-2 text-right text-rose-400">
                              {fmt(Math.max(0, r.gain_loss) * 0.20)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tax Harvesting */}
              {data.tax_harvest_opportunities.length > 0 && (
                <div className="rounded-2xl border border-violet-800/30 bg-violet-950/10 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-violet-400">
                    Tax Harvesting Opportunities
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Funds with unrealised losses. Redeeming and reinvesting can book losses to offset other gains.
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                          <th className="pb-2 pr-4">Fund</th>
                          <th className="pb-2 pr-4 text-right">Unrealised Loss</th>
                          <th className="pb-2 text-right">Potential Tax Saving</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {data.tax_harvest_opportunities.map((r) => (
                          <tr key={r.holding_id} className="hover:bg-slate-800/30">
                            <td className="py-2 pr-4">
                              <div className="max-w-xs truncate font-medium text-slate-100">{r.fund_name}</div>
                              <div className="text-xs text-slate-500">{r.category}</div>
                            </td>
                            <td className="py-2 pr-4 text-right font-medium text-rose-400">{fmt(r.gain_loss)}</td>
                            <td className="py-2 text-right font-medium text-violet-300">{fmt(r.potential_tax_saving)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600">
                Disclaimer: This is an estimate for planning purposes only. Consult a tax advisor for filing. Tax laws may change.
              </p>
            </div>
          )}
    </div>
  );
}
