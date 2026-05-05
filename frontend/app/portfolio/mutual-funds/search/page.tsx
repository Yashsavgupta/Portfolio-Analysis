'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { formatCurrency } from '@/lib/format';

interface SearchResult {
  id: number;
  name: string;
  fund_house: string;
  category: string;
  current_nav?: number;
  return_1y?: number;
  return_3y?: number;
  expense_ratio?: number;
}

export default function MutualFundSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchFunds = async () => {
    if (!query.trim()) {
      setError('Enter a fund name or code to search.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(apiUrl(`/api/mutual-funds/?query=${encodeURIComponent(query)}&limit=50`), {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to search funds');
      }

      const data = await response.json();
      setResults(data.funds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold">Search Mutual Funds</h1>
              <p className="mt-2 text-slate-400">Search available mutual funds by name or fund code.</p>
            </div>
            <Link
              href="/portfolio/mutual-funds"
              className="rounded-lg bg-slate-700 px-6 py-2.5 font-medium hover:bg-slate-600 transition"
            >
              Back to Portfolio
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by fund name or code"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none focus:border-blue-500 sm:max-w-2xl"
              />
              <button
                onClick={searchFunds}
                disabled={loading}
                className="rounded-2xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition disabled:opacity-60"
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
                {error}
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="mt-8 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="px-4 py-3">Fund</th>
                      <th className="px-4 py-3">House</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">NAV</th>
                      <th className="px-4 py-3 text-right">1Y</th>
                      <th className="px-4 py-3 text-right">3Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((fund) => (
                      <tr key={fund.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-100">{fund.name}</td>
                        <td className="px-4 py-3">{fund.fund_house}</td>
                        <td className="px-4 py-3">{fund.category}</td>
                        <td className="px-4 py-3 text-right">{fund.current_nav ? formatCurrency(fund.current_nav) : '-'}</td>
                        <td className="px-4 py-3 text-right">{fund.return_1y ? `${fund.return_1y.toFixed(2)}%` : '-'}</td>
                        <td className="px-4 py-3 text-right">{fund.return_3y ? `${fund.return_3y.toFixed(2)}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !loading && (
                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-slate-400">
                  Search for mutual funds by name or code to see results here.
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
