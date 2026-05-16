'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import MFNavTabs from '@/components/mf/MFNavTabs';
import { useMFPortfolioId, fetchMFAnalysis } from '@/lib/mf';
import { getAuthHeaders } from '@/lib/auth';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = [
  '#38bdf8', '#14b8a6', '#818cf8', '#fb923c',
  '#34d399', '#f472b6', '#facc15', '#60a5fa',
  '#a78bfa', '#4ade80',
];

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

interface Slice {
  name: string;
  invested: number;
  current_value: number;
  gain_loss: number;
  weight: number;
  count: number;
}

interface AllocationData {
  total_invested: number;
  total_current_value: number;
  num_funds: number;
  by_category: Slice[];
  by_fund_house: Slice[];
  by_asset_type: Slice[];
  by_plan_type: Slice[];
  top_holdings: {
    fund_name: string;
    fund_house: string;
    category: string;
    plan_type: string;
    invested: number;
    current_value: number;
    weight: number;
    gain_loss_pct: number;
  }[];
  hhi: number;
  concentration_label: string;
}

function DonutChart({ data, title }: { data: Slice[]; title: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">{title}</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="current_value"
              nameKey="name"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => fmt(v as number)}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 space-y-1.5">
        {data.map((s, i) => (
          <div key={s.name} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="truncate text-slate-300">{s.name}</span>
            </div>
            <span className="shrink-0 text-slate-400">{s.weight.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AllocationPage() {
  const { portfolioId, loading: pidLoading, empty } = useMFPortfolioId();
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    fetchMFAnalysis<AllocationData>(
      `/api/mutual-funds/portfolio/${portfolioId}/allocation-detail`,
      getAuthHeaders() as HeadersInit,
    )
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  const isLoading = pidLoading || loading;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="text-4xl font-bold">Mutual Funds</h1>
            <p className="mt-1 text-slate-400">Allocation Analysis</p>
          </div>

          <MFNavTabs />

          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-800" />
              ))}
            </div>
          )}

          {!isLoading && empty && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-10 text-center">
              <p className="text-slate-400">No mutual fund holdings yet.</p>
              <Link href="/import-mutual-funds" className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition">
                Import Funds
              </Link>
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>
          )}

          {!isLoading && data && (
            <div className="space-y-6">
              {/* Header stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Invested', value: fmt(data.total_invested) },
                  { label: 'Current Value', value: fmt(data.total_current_value) },
                  {
                    label: 'Total Gain/Loss',
                    value: fmt(data.total_current_value - data.total_invested),
                    cls: tone(data.total_current_value - data.total_invested),
                  },
                  { label: 'No. of Funds', value: String(data.num_funds) },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-widest text-slate-500">{s.label}</div>
                    <div className={`mt-2 text-xl font-semibold ${s.cls ?? 'text-white'}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Concentration badge */}
              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-3">
                <span className="text-sm text-slate-400">Concentration Risk</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    data.concentration_label === 'Low'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : data.concentration_label === 'Moderate'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {data.concentration_label}
                </span>
                <span className="text-xs text-slate-500">HHI: {data.hhi}</span>
              </div>

              {/* Donut charts */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <DonutChart data={data.by_asset_type} title="Asset Type" />
                <DonutChart data={data.by_category} title="Category" />
                <DonutChart data={data.by_fund_house} title="Fund House (AMC)" />
              </div>

              {/* Direct vs Regular */}
              {data.by_plan_type.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Plan Type</h3>
                  <div className="flex flex-wrap gap-4">
                    {data.by_plan_type.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <div>
                          <div className="text-sm font-medium text-slate-200">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.weight.toFixed(1)}% · {fmt(p.current_value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {data.by_plan_type.some((p) => p.name.toLowerCase() === 'regular') && (
                    <p className="mt-3 text-xs text-amber-400/80">
                      💡 Consider switching Regular plan funds to Direct plans — they typically have 0.5–1.5% lower expense ratios, compounding significantly over time.
                    </p>
                  )}
                </div>
              )}

              {/* Top Holdings */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Holdings by Weight</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                        <th className="pb-3 pr-4">Fund</th>
                        <th className="pb-3 pr-4">Category</th>
                        <th className="pb-3 pr-4 text-right">Weight</th>
                        <th className="pb-3 pr-4 text-right">Invested</th>
                        <th className="pb-3 pr-4 text-right">Current</th>
                        <th className="pb-3 text-right">Return</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.top_holdings.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-slate-100 max-w-xs truncate">{h.fund_name}</div>
                            <div className="text-xs text-slate-500">{h.fund_house}</div>
                          </td>
                          <td className="py-3 pr-4 text-slate-400">{h.category}</td>
                          <td className="py-3 pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 rounded-full bg-sky-500/30 overflow-hidden w-16">
                                <div
                                  className="h-full rounded-full bg-sky-500"
                                  style={{ width: `${Math.min(h.weight, 100)}%` }}
                                />
                              </div>
                              <span className="text-slate-300 w-10 text-right">{h.weight.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-400">{fmt(h.invested)}</td>
                          <td className="py-3 pr-4 text-right text-slate-200">{fmt(h.current_value)}</td>
                          <td className={`py-3 text-right font-medium ${tone(h.gain_loss_pct)}`}>
                            {h.gain_loss_pct >= 0 ? '+' : ''}{h.gain_loss_pct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
