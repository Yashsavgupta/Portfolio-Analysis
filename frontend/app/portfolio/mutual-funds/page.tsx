'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MutualFundSummary from '@/components/holdings/MutualFundSummary';
import MutualFundList from '@/components/holdings/MutualFundList';
import { apiCall, apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import MFNavTabs from '@/components/mf/MFNavTabs';

interface MFSummary {
  total_invested: number;
  total_value: number;
  total_gain_loss: number;
  total_gain_loss_pct: number;
  num_funds: number;
  by_category: Record<string, any>;
  by_house: Record<string, any>;
}

interface MFHolding {
  id: number;
  portfolio_id: number;
  mutual_fund_id: number;
  fund_name: string;
  fund_house: string;
  category: string;
  units: number;
  current_nav: number;
  cost_basis: number;
  current_value: number;
  gain_loss: number;
  gain_loss_pct: number;
  purchase_date: string;
  plan_type: string;
  source: string;
  is_long_term: boolean;
  holding_days?: number;
  nav_at_purchase?: number;
  fund_1y_return?: number;
  fund_3y_return?: number;
}

export default function MutualFundsPage() {
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [summary, setSummary] = useState<MFSummary | null>(null);
  const [holdings, setHoldings] = useState<MFHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('portfolio');
    if (idParam) {
      const id = Number(idParam);
      setPortfolioId(id);
      fetchMutualFundData(id);
    } else {
      // Auto-detect the user's most recent MF portfolio
      fetchMutualFundData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMutualFundData = async (id: number | null) => {
    try {
      setLoading(true);
      setError(null);
      setSyncMessage(null);

      if (id === null) {
        // Use the auto-detect endpoint to find the user's MF portfolio
        const autoRes = await fetch(apiUrl('/api/mutual-funds/my-portfolio/summary'), {
          headers: getAuthHeaders() as HeadersInit,
        });
        if (autoRes.status === 404) {
          setSummary(null);
          setHoldings([]);
          return;
        }
        if (!autoRes.ok) throw new Error('Failed to fetch mutual fund summary');
        const autoData = await autoRes.json();
        const detectedId: number = autoData.portfolio_id;
        setPortfolioId(detectedId);
        setSummary(autoData);

        const holdingsRes = await fetch(apiUrl(`/api/mutual-funds/portfolio/${detectedId}/holdings?limit=50`), {
          headers: getAuthHeaders() as HeadersInit,
        });
        if (!holdingsRes.ok) throw new Error('Failed to fetch mutual fund holdings');
        const holdingsData = await holdingsRes.json();
        setHoldings(holdingsData.holdings || []);
        return;
      }

      const summaryRes = await fetch(apiUrl(`/api/mutual-funds/portfolio/${id}/summary`), {
        headers: getAuthHeaders() as HeadersInit,
      });
      if (summaryRes.status === 404) {
        setSummary(null);
        setHoldings([]);
        return;
      }
      if (!summaryRes.ok) throw new Error('Failed to fetch mutual fund summary');
      setSummary(await summaryRes.json());

      const holdingsRes = await fetch(apiUrl(`/api/mutual-funds/portfolio/${id}/holdings?limit=50`), {
        headers: getAuthHeaders() as HeadersInit,
      });
      if (!holdingsRes.ok) throw new Error('Failed to fetch mutual fund holdings');
      const data = await holdingsRes.json();
      setHoldings(data.holdings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching mutual fund data');
      console.error('Error fetching mutual fund data:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncFundData = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSyncMessage(null);

      const response = await apiCall('/api/mutual-funds/sync/fund-data', 'POST');
      setSyncMessage(response.message || 'Mutual fund data sync completed successfully.');
      fetchMutualFundData(portfolioId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
      console.error('Error syncing mutual fund data:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <MFNavTabs />
        <button
          type="button"
          onClick={syncFundData}
          disabled={loading || syncing}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Refresh NAV'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {syncMessage && !error && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-200">
          {syncMessage}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 rounded-lg bg-slate-800/60 animate-pulse" />
          <div className="h-96 rounded-lg bg-slate-800/60 animate-pulse" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
          <p className="text-lg font-semibold text-white">No mutual fund holdings yet</p>
          <p className="mt-2 text-sm text-slate-400">
            Import your INDmoney export to get started.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/import?type=holdings"
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 transition"
            >
              Import Funds
            </Link>
          </div>
        </div>
      ) : (
        <>
          {summary ? <MutualFundSummary summary={summary} /> : null}
          <div className="mt-8">
            <MutualFundList holdings={holdings} />
          </div>
        </>
      )}
    </div>
  );
}
