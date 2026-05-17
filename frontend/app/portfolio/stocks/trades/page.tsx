'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StocksNavTabs from '@/components/stocks/StocksNavTabs';
import TradeCoverage from '@/components/stocks/TradeCoverage';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { formatCurrency } from '@/lib/format';

interface Trade {
  id: number;
  symbol: string;
  isin: string | null;
  trade_date: string;
  exchange: string | null;
  segment: string | null;
  series: string | null;
  trade_type: 'buy' | 'sell';
  quantity: number;
  price: number;
  trade_value: number;
  trade_id: string | null;
  order_id: string | null;
  order_execution_time: string | null;
}

interface TradesData {
  trades: Trade[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;

export default function TradesPage() {
  const [data, setData] = useState<TradesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [symbol, setSymbol] = useState('');
  const [tradeType, setTradeType] = useState<'all' | 'buy' | 'sell'>('all');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (symbol) params.set('symbol', symbol.toUpperCase());
    if (tradeType !== 'all') params.set('trade_type', tradeType);

    const res = await fetch(apiUrl(`/api/portfolios/trades?${params}`), {
      headers: getAuthHeaders() as HeadersInit,
    });
    setData(await res.json());
    setLoading(false);
  }, [page, symbol, tradeType]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div>
      <StocksNavTabs />
      <TradeCoverage />

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={symbol}
              onChange={(e) => { setSymbol(e.target.value); setPage(0); }}
              placeholder="Filter by symbol..."
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1">
              {(['all', 'buy', 'sell'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setTradeType(f); setPage(0); }}
                  className={`rounded px-3 py-1 text-sm font-medium capitalize transition ${tradeType === f ? (f === 'buy' ? 'bg-emerald-700 text-white' : f === 'sell' ? 'bg-red-700 text-white' : 'bg-blue-600 text-white') : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            {data && <span className="text-sm text-slate-500">{data.total} trades total</span>}
          </div>

          {loading && <div className="h-64 rounded-2xl bg-slate-800 animate-pulse" />}

          {!loading && data && data.trades.length === 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-10 text-center">
              <h2 className="text-2xl font-semibold">No Trades Found</h2>
              <p className="mt-2 text-slate-400">
                {data.total === 0
                  ? 'Import your Zerodha tradebook to see trades here.'
                  : 'No trades match your current filter.'}
              </p>
              {data.total === 0 && (
                <Link href="/import?type=tradebook" className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition">
                  Import Tradebook
                </Link>
              )}
            </div>
          )}

          {!loading && data && data.trades.length > 0 && (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                      {['Date', 'Symbol', 'Type', 'Qty', 'Price', 'Value', 'Exchange', 'Segment', 'Trade ID'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.map((t) => (
                      <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{t.trade_date}</td>
                        <td className="px-4 py-2.5 font-semibold text-white">{t.symbol}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.trade_type === 'buy' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                            {t.trade_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{t.quantity}</td>
                        <td className="px-4 py-2.5 text-slate-300">{formatCurrency(t.price)}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-200">{formatCurrency(t.trade_value)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{t.exchange ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{t.segment ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">{t.trade_id ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-400">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
    </div>
  );
}
