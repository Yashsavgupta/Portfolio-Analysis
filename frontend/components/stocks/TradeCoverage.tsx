'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

interface Gap {
  from: string;
  to: string;
  days: number;
  note: string;
}

interface Coverage {
  has_data: boolean;
  from: string | null;
  to: string | null;
  total_trades: number;
  gaps: Gap[];
  by_year: Record<string, number>;
}

export default function TradeCoverage() {
  const [data, setData] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/portfolios/trade-coverage'), {
      headers: getAuthHeaders() as HeadersInit,
    })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-28 rounded-2xl bg-slate-800 animate-pulse mb-6" />;
  }

  if (!data || !data.has_data) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-300">No tradebook data yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Import your trade history to unlock XIRR, realized P&L, and tax analysis.
          </p>
        </div>
        <Link
          href="/import?type=tradebook"
          className="whitespace-nowrap rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          Import Tradebook
        </Link>
      </div>
    );
  }

  const years = Object.keys(data.by_year).map(Number).sort();
  const maxCount = Math.max(...Object.values(data.by_year));

  return (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-200">Trade History Coverage</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.from} &rarr; {data.to} &middot; {data.total_trades.toLocaleString()} trades
          </p>
        </div>
        <div className="flex gap-2">
          {data.gaps.length > 0 && (
            <span className="rounded-full border border-amber-700/50 bg-amber-900/20 px-2.5 py-1 text-xs text-amber-300">
              ⚠ {data.gaps.length} gap{data.gaps.length > 1 ? 's' : ''} detected
            </span>
          )}
          <Link
            href="/import?type=tradebook"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            + Add more
          </Link>
        </div>
      </div>

      {/* Year bars */}
      <div className="flex items-end gap-1.5 h-14 mb-1">
        {years.map((yr) => {
          const count = data.by_year[yr] ?? 0;
          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={yr} className="flex flex-col items-center flex-1 min-w-0" title={`${yr}: ${count} trades`}>
              <div className="w-full rounded-t" style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: '#3b82f6', opacity: 0.75 + (heightPct / 100) * 0.25 }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {years.map((yr) => (
          <div key={yr} className="flex-1 min-w-0 text-center text-xs text-slate-600 truncate">{yr}</div>
        ))}
      </div>

      {/* Gaps */}
      {data.gaps.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-700/30 bg-amber-900/10 p-3">
          <p className="text-xs font-semibold text-amber-300 mb-1.5">Missing periods in your history</p>
          <div className="space-y-1">
            {data.gaps.map((g, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {g.from} → {g.to}
                </span>
                <span className="text-slate-500">{g.days} days</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Import files for these periods for complete XIRR and P&L calculations.
          </p>
        </div>
      )}
    </div>
  );
}
