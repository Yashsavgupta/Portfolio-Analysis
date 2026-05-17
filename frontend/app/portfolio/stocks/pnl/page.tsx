'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StocksNavTabs from '@/components/stocks/StocksNavTabs';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { formatCurrency, formatPercent } from '@/lib/format';

interface Lot {
  symbol: string;
  isin: string | null;
  buy_date: string;
  sell_date: string;
  holding_days: number;
  quantity: number;
  buy_price: number;
  sell_price: number;
  buy_value: number;
  sell_value: number;
  realized_gain: number;
  tax_category: 'LTCG' | 'STCG';
  tax_rate: number;
}

interface Summary {
  total_realized: number;
  ltcg_gain: number;
  stcg_gain: number;
  ltcg_taxable: number;
  ltcg_tax: number;
  stcg_tax: number;
  total_estimated_tax: number;
}

interface PnLData {
  lots: Lot[];
  summary: Summary;
  no_trades?: boolean;
}

function gainColor(v: number) {
  return v >= 0 ? 'text-emerald-400' : 'text-red-400';
}

export default function RealizedPnLPage() {
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'LTCG' | 'STCG'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/portfolios/realized-pnl'), { headers: getAuthHeaders() as HeadersInit })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const lots = (data?.lots ?? []).filter(
    (l) =>
      (filter === 'all' || l.tax_category === filter) &&
      (!search || l.symbol.includes(search.toUpperCase())),
  );

  return (
    <div>
      <StocksNavTabs />

          {loading && <div className="h-64 rounded-2xl bg-slate-800 animate-pulse" />}

          {!loading && data?.no_trades && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-10 text-center">
              <h2 className="text-2xl font-semibold">No Tradebook Data</h2>
              <p className="mt-2 text-slate-400">Import your Zerodha tradebook to see realized P&L.</p>
              <Link href="/import?type=tradebook" className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition">
                Import Tradebook
              </Link>
            </div>
          )}

          {!loading && data && !data.no_trades && (
            <>
              {/* Summary tiles */}
              <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Realized', value: data.summary.total_realized, color: gainColor(data.summary.total_realized) },
                  { label: 'LTCG Gain', value: data.summary.ltcg_gain, color: gainColor(data.summary.ltcg_gain) },
                  { label: 'STCG Gain', value: data.summary.stcg_gain, color: gainColor(data.summary.stcg_gain) },
                  { label: 'Est. Tax Liability', value: data.summary.total_estimated_tax, color: 'text-amber-400' },
                ].map((t) => (
                  <div key={t.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{t.label}</p>
                    <p className={`mt-1 text-xl font-bold ${t.color}`}>
                      {t.value >= 0 ? '' : '–'}{formatCurrency(Math.abs(t.value))}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tax breakdown info */}
              <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 text-sm text-slate-400 flex flex-wrap gap-6">
                <span>LTCG ({'>'}1 yr): 12.5% on gains over ₹1L exemption (taxable: {formatCurrency(data.summary.ltcg_taxable)})</span>
                <span>STCG ({'≤'}1 yr): 20% on all gains</span>
                <span className="text-amber-400 font-medium">Estimated tax: {formatCurrency(data.summary.total_estimated_tax)}</span>
              </div>

              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1">
                  {(['all', 'LTCG', 'STCG'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded px-3 py-1 text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by symbol..."
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-500">{lots.length} lot{lots.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Lots table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                      {['Symbol', 'Qty', 'Buy Date', 'Sell Date', 'Days', 'Buy Price', 'Sell Price', 'Buy Value', 'Sell Value', 'Gain/Loss', 'Type'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lots.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center text-slate-500">No realized trades match this filter.</td>
                      </tr>
                    ) : (
                      lots.map((l, i) => (
                        <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-semibold text-white">{l.symbol}</td>
                          <td className="px-4 py-3 text-slate-300">{l.quantity}</td>
                          <td className="px-4 py-3 text-slate-400">{l.buy_date}</td>
                          <td className="px-4 py-3 text-slate-400">{l.sell_date}</td>
                          <td className="px-4 py-3 text-slate-400">{l.holding_days}d</td>
                          <td className="px-4 py-3 text-slate-300">{formatCurrency(l.buy_price)}</td>
                          <td className="px-4 py-3 text-slate-300">{formatCurrency(l.sell_price)}</td>
                          <td className="px-4 py-3 text-slate-300">{formatCurrency(l.buy_value)}</td>
                          <td className="px-4 py-3 text-slate-300">{formatCurrency(l.sell_value)}</td>
                          <td className={`px-4 py-3 font-semibold ${gainColor(l.realized_gain)}`}>
                            {l.realized_gain >= 0 ? '+' : ''}{formatCurrency(l.realized_gain)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.tax_category === 'LTCG' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}>
                              {l.tax_category}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
    </div>
  );
}
