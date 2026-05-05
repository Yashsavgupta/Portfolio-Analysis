'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import MutualFundSummary from '@/components/holdings/MutualFundSummary';
import MutualFundList from '@/components/holdings/MutualFundList';
import MutualFundImportModal from '@/components/holdings/MutualFundImportModal';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { apiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';

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
  fund_id: number;
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
  fund_1y_return?: number;
  fund_3y_return?: number;
}

export default function MutualFundsPage() {
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [summary, setSummary] = useState<MFSummary | null>(null);
  const [holdings, setHoldings] = useState<MFHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get portfolio ID from URL or use a default
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[2] ? parseInt(pathParts[2]) : 1;
    setPortfolioId(id);
    fetchMutualFundData(id);
  }, []);

  const fetchMutualFundData = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      // Fetch summary
      const summaryRes = await fetch(apiUrl(`/api/mutual-funds/portfolio/${id}/summary`), { headers });
      if (!summaryRes.ok) throw new Error('Failed to fetch summary');
      setSummary(await summaryRes.json());

      // Fetch holdings
      const holdingsRes = await fetch(apiUrl(`/api/mutual-funds/portfolio/${id}/holdings?limit=50`), { headers });
      if (!holdingsRes.ok) throw new Error('Failed to fetch holdings');
      const data = await holdingsRes.json();
      setHoldings(data.holdings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching mutual fund data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    if (portfolioId) {
      fetchMutualFundData(portfolioId);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Mutual Funds</h1>
              <p className="mt-2 text-slate-400">Analyze and manage your mutual fund portfolio</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowImportModal(true)}
                className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium hover:bg-blue-700 transition"
              >
                + Import from INDmoney
              </button>
              <Link
                href="/portfolio/mutual-funds/search"
                className="rounded-lg bg-slate-700 px-6 py-2.5 font-medium hover:bg-slate-600 transition"
              >
                Search Funds
              </Link>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-300">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="space-y-6">
              <div className="h-32 rounded-lg bg-slate-800 animate-pulse" />
              <div className="h-96 rounded-lg bg-slate-800 animate-pulse" />
            </div>
          )}

          {/* Empty State */}
          {!loading && holdings.length === 0 && !error && (
            <EmptyState
              title="No Mutual Fund Holdings"
              description="You haven't added any mutual funds to this portfolio yet. Import from INDmoney or search for funds to get started."
              action={
                <button
                  onClick={() => setShowImportModal(true)}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium hover:bg-blue-700 transition"
                >
                  Import from INDmoney
                </button>
              }
            />
          )}

          {/* Summary Cards */}
          {!loading && summary && holdings.length > 0 && (
            <>
              <MutualFundSummary summary={summary} />

              {/* Holdings List */}
              <div className="mt-10">
                <MutualFundList holdings={holdings} />
              </div>
            </>
          )}

          {/* Import Modal */}
          {showImportModal && portfolioId && (
            <MutualFundImportModal
              portfolioId={portfolioId}
              onClose={handleImportSuccess}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
      />
    );
  }

  const totalMFValue = mfHoldings.reduce((sum, h) => sum + h.market_value, 0);
  const totalMFInvested = mfHoldings.reduce((sum, h) => sum + h.invested_value, 0);
  const totalMFReturn = totalMFValue - totalMFInvested;
  const totalMFPreviousValue = mfHoldings.reduce((sum, h) => sum + h.previous_value, 0);
  const totalMFDayPnl = mfHoldings.reduce((sum, h) => sum + h.day_pnl, 0);
  const totalMFDayChangePct = totalMFPreviousValue > 0 ? (totalMFDayPnl / totalMFPreviousValue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total MF Value</div>
          <div className="mt-3 text-2xl font-semibold text-slate-100">{formatCurrency(totalMFValue)}</div>
        </Card>

        <Card className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total Return</div>
          <div className={`mt-3 text-2xl font-semibold ${totalMFReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(totalMFReturn)}
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Daily Change</div>
          <div className={`mt-3 text-2xl font-semibold ${totalMFDayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatPercent(totalMFDayChangePct)}
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">MF Holdings</div>
          <div className="mt-3 text-2xl font-semibold text-slate-100">{mfHoldings.length}</div>
        </Card>
      </div>

      {/* Mutual Funds Holdings Table */}
      <Card className="p-6">
        <h2 className="mb-6 text-xl font-semibold">Mutual Fund Holdings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left font-medium text-slate-300">Symbol</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Fund Name</th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">Price</th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">Day Change</th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">Value</th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">Weight</th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">Return</th>
                <th className="px-4 py-3 text-right font-medium text-slate-300">Signal</th>
              </tr>
            </thead>
            <tbody>
              {mfHoldings.map((holding, idx) => (
                <tr key={`${holding.symbol}-${idx}`} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-slate-100">{holding.symbol}</td>
                  <td className="px-4 py-3 text-slate-300">{holding.name}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(holding.price)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${holding.day_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPercent(holding.day_change_pct)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(holding.market_value)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatPercent(holding.weight)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${holding.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPercent(holding.total_return_pct)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${signalClasses(holding.signal)}`}>
                      {holding.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
