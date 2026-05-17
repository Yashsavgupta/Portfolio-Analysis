'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StocksNavTabs from '@/components/stocks/StocksNavTabs';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { formatCurrency, formatPercent } from '@/lib/format';

interface StockPerf {
  symbol: string;
  quantity: number;
  avg_cost: number;
  ltp: number;
  invested: number;
  current_value: number;
  unrealized_gain: number;
  unrealized_pct: number;
  realized_gain: number;
  total_gain: number;
  xirr: number | null;
  holding_days: number;
  first_buy_date: string;
}

interface Analysis {
  portfolio_xirr: number | null;
  total_invested: number;
  total_current_value: number;
  total_unrealized_gain: number;
  total_unrealized_pct: number;
  open_positions_count: number;
  no_trades?: boolean;
  per_stock: StockPerf[];
}

function gainColor(v: number) {
  return v >= 0 ? 'text-emerald-400' : 'text-red-400';
}

function XIRRBadge({ xirr }: { xirr: number | null }) {
  if (xirr === null) return <span className="text-slate-500 text-xs">N/A</span>;
  const color = xirr >= 0 ? 'text-emerald-400' : 'text-red-400';
  return <span className={`font-semibold ${color}`}>{formatPercent(xirr)}</span>;
}

export default function StocksPerformancePage() {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: keyof StockPerf; dir: 'asc' | 'desc' }>({
    key: 'current_value',
    dir: 'desc',
  });

  useEffect(() => {
    fetch(apiUrl('/api/portfolios/trade-analysis'), { headers: getAuthHeaders() as HeadersInit })
      .then(async (r) => {
        const json = await r.json().catch(() => ({ detail: `Server error (${r.status})` }));
        if (!r.ok) throw new Error(json?.detail ?? `Request failed (${r.status})`);
        return json;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: keyof StockPerf) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  };

  const sorted = data?.per_stock
    ? [...data.per_stock].sort((a, b) => {
        const av = a[sort.key] ?? 0;
        const bv = b[sort.key] ?? 0;
        return sort.dir === 'desc'
          ? (bv as number) - (av as number)
          : (av as number) - (bv as number);
      })
    : [];

  return (
    <div>
      <StocksNavTabs />

      {loading && (
        <div className="mt-4 space-y-4">
          <div className="h-40 rounded-2xl bg-slate-800/60 animate-pulse" />
          <div className="h-96 rounded-2xl bg-slate-800/60 animate-pulse" />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-300">{error}</div>
      )}

      {!loading && data?.no_trades && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
          <p className="text-lg font-semibold text-white">No tradebook data yet</p>
          <p className="mt-2 text-sm text-slate-400">Upload your Zerodha tradebook CSV to see XIRR and performance analysis.</p>
          <Link
            href="/import?type=tradebook"
            className="mt-6 inline-block rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 transition"
          >
            Import Tradebook
          </Link>
        </div>
      )}

          {!loading && data && !data.no_trades && (
            <>
              {/* Hero */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="col-span-1 sm:col-span-2 rounded-2xl bg-gradient-to-br from-blue-900/60 to-slate-900 border border-blue-700/40 p-6">
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Portfolio XIRR</p>
                  {data.portfolio_xirr !== null ? (
                    <p className={`mt-1 text-5xl font-bold ${gainColor(data.portfolio_xirr)}`}>
                      {formatPercent(data.portfolio_xirr)}
                    </p>
                  ) : (
                    <p className="mt-1 text-3xl font-bold text-slate-500">N/A</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Internal rate of return accounting for timing of all cash flows
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Total Invested</p>
                  <p className="mt-1 text-2xl font-bold">{formatCurrency(data.total_invested)}</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Current Value</p>
                  <p className={`mt-1 text-2xl font-bold ${gainColor(data.total_unrealized_gain)}`}>
                    {formatCurrency(data.total_current_value)}
                  </p>
                  <p className={`text-sm ${gainColor(data.total_unrealized_gain)}`}>
                    {data.total_unrealized_gain >= 0 ? '+' : ''}
                    {formatCurrency(data.total_unrealized_gain)} ({formatPercent(data.total_unrealized_pct)})
                  </p>
                </div>
              </div>

              {/* Top movers */}
              {sorted.length >= 2 && (
                <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Best performer */}
                  {(() => {
                    const best = [...sorted].sort((a, b) => (b.unrealized_pct ?? 0) - (a.unrealized_pct ?? 0))[0];
                    return (
                      <div className="rounded-2xl border border-emerald-700/30 bg-emerald-900/10 p-5">
                        <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Best Performer</p>
                        <p className="text-xl font-bold text-white">{best.symbol}</p>
                        <p className="text-emerald-400 font-semibold text-lg">+{formatPercent(best.unrealized_pct)}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {formatCurrency(best.invested)} &rarr; {formatCurrency(best.current_value)}
                        </p>
                      </div>
                    );
                  })()}
                  {/* Worst performer */}
                  {(() => {
                    const worst = [...sorted].sort((a, b) => (a.unrealized_pct ?? 0) - (b.unrealized_pct ?? 0))[0];
                    return (
                      <div className="rounded-2xl border border-red-700/30 bg-red-900/10 p-5">
                        <p className="text-xs text-red-400 uppercase tracking-wider mb-1">Worst Performer</p>
                        <p className="text-xl font-bold text-white">{worst.symbol}</p>
                        <p className="text-red-400 font-semibold text-lg">{formatPercent(worst.unrealized_pct)}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {formatCurrency(worst.invested)} &rarr; {formatCurrency(worst.current_value)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                      {[
                        { key: 'symbol', label: 'Symbol' },
                        { key: 'quantity', label: 'Qty' },
                        { key: 'avg_cost', label: 'Avg Cost' },
                        { key: 'ltp', label: 'LTP' },
                        { key: 'invested', label: 'Invested' },
                        { key: 'current_value', label: 'Value' },
                        { key: 'unrealized_gain', label: 'Unrealized' },
                        { key: 'realized_gain', label: 'Realized' },
                        { key: 'xirr', label: 'XIRR' },
                        { key: 'holding_days', label: 'Days' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 text-left cursor-pointer hover:text-slate-200 select-none"
                          onClick={() => toggleSort(col.key as keyof StockPerf)}
                        >
                          {col.label}
                          {sort.key === col.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s) => (
                      <tr key={s.symbol} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-semibold text-white">{s.symbol}</td>
                        <td className="px-4 py-3 text-slate-300">{s.quantity}</td>
                        <td className="px-4 py-3 text-slate-300">{formatCurrency(s.avg_cost)}</td>
                        <td className="px-4 py-3 text-slate-300">{formatCurrency(s.ltp)}</td>
                        <td className="px-4 py-3 text-slate-300">{formatCurrency(s.invested)}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(s.current_value)}</td>
                        <td className={`px-4 py-3 font-medium ${gainColor(s.unrealized_gain)}`}>
                          {s.unrealized_gain >= 0 ? '+' : ''}{formatCurrency(s.unrealized_gain)}
                          <span className="ml-1 text-xs">({formatPercent(s.unrealized_pct)})</span>
                        </td>
                        <td className={`px-4 py-3 ${gainColor(s.realized_gain)}`}>
                          {s.realized_gain !== 0
                            ? `${s.realized_gain >= 0 ? '+' : ''}${formatCurrency(s.realized_gain)}`
                            : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-4 py-3"><XIRRBadge xirr={s.xirr} /></td>
                        <td className="px-4 py-3 text-slate-400">{s.holding_days}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
    </div>
  );
}
