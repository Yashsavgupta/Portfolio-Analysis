'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

interface SearchResult {
  scheme_code: number;
  name: string;
}

export default function MutualFundSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchFunds = async () => {
    if (!query.trim()) {
      setError('Enter a fund name to search.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        apiUrl(`/api/mutual-funds/search-live?q=${encodeURIComponent(query.trim())}`),
        { headers: getAuthHeaders() as HeadersInit },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to search funds');
      }

      const data = await response.json();
      setResults(data.funds || []);
      if ((data.funds || []).length === 0) {
        setError('No funds found. Try a different search term.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') searchFunds();
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold">Search Mutual Funds</h1>
              <p className="mt-2 text-slate-400">Search across all Indian mutual funds by name or scheme.</p>
            </div>
            <Link
              href="/portfolio/mutual-funds"
              className="rounded-lg bg-slate-700 px-6 py-2.5 font-medium hover:bg-slate-600 transition"
            >
              Back to Portfolio
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Parag Parikh, Mirae Asset, HDFC Flexi Cap…"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none focus:border-blue-500 sm:max-w-2xl"
              />
              <button
                onClick={searchFunds}
                disabled={loading}
                className="shrink-0 rounded-2xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition disabled:opacity-60"
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
              <div className="mt-8 divide-y divide-slate-800 rounded-2xl border border-slate-800 overflow-hidden">
                {results.map((fund) => (
                  <div
                    key={fund.scheme_code}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/50 transition"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-100">{fund.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">Scheme Code: {fund.scheme_code}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !loading && !error && (
                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-slate-400 text-center">
                  Search for mutual funds by name to see results here.
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
