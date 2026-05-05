'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import Card from '@/components/ui/Card';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

interface AnalyticsProps {
  portfolioId: number;
}

interface PortfolioOverview {
  invested_value: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  total_holdings: number;
  holdings: any[];
}

interface ValuationHolding {
  symbol: string;
  pe: number | null;
  forward_pe: number | null;
  value: number;
}

interface ValuationMetrics {
  portfolio_pe: number | null;
  portfolio_forward_pe: number | null;
  benchmark_pe: number;
  holdings: ValuationHolding[];
}

interface GrowthHolding {
  symbol: string;
  current_price: number;
  target_price: number | null;
  upside_downside_pct: number;
  eps_growth: number | null;
  revenue_growth: number | null;
}

interface GrowthForecast {
  holdings: GrowthHolding[];
  avg_target_upside: number;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function PortfolioOverviewCard({ portfolioId }: AnalyticsProps) {
  const [data, setData] = useState<PortfolioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAnalytics();
  }, [portfolioId]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/import/analytics/overview/${portfolioId}`), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Failed to load analytics');
      }
    } catch (err) {
      setError('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <div className="p-4">
          <p className="text-slate-400 text-sm">Invested Value</p>
          <p className="text-3xl font-bold text-white">₹{data.invested_value.toLocaleString('en-IN')}</p>
        </div>
      </Card>
      <Card>
        <div className="p-4">
          <p className="text-slate-400 text-sm">Current Value</p>
          <p className="text-3xl font-bold text-white">₹{data.current_value.toLocaleString('en-IN')}</p>
        </div>
      </Card>
      <Card>
        <div className={`p-4 ${data.unrealized_pnl >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
          <p className="text-slate-400 text-sm">Total P&L</p>
          <p className={`text-3xl font-bold ${data.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ₹{data.unrealized_pnl.toLocaleString('en-IN')}
          </p>
          <p className={`text-sm mt-1 ${data.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.unrealized_pnl_pct.toFixed(2)}%
          </p>
        </div>
      </Card>
      <Card>
        <div className="p-4">
          <p className="text-slate-400 text-sm">Total Holdings</p>
          <p className="text-3xl font-bold text-white">{data.total_holdings}</p>
        </div>
      </Card>
    </div>
  );
}

export function SectorSegmentationCard({ portfolioId }: AnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAnalytics();
  }, [portfolioId]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/import/analytics/sectors/${portfolioId}`), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Failed to load sector data');
      }
    } catch (err) {
      setError('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-4">Sector Segmentation</h3>
        {data.concentration_risk && (
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
            <p className="text-yellow-400 text-sm">⚠️ High concentration risk detected</p>
          </div>
        )}
        <div className="space-y-4">
          {Object.entries(data.sectors).map(([sector, sectorData]: [string, any]) => (
            <div key={sector}>
              <div className="flex justify-between items-center mb-1">
                <p className="font-medium">{sector}</p>
                <p className="text-slate-400">{sectorData.pct}%</p>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${sectorData.pct}%` }}
                />
              </div>
              <p className="text-slate-400 text-xs mt-1">
                ₹{sectorData.value.toLocaleString('en-IN')} ({sectorData.holdings_count} holdings)
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function TaxSnapshotCard({ portfolioId }: AnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAnalytics();
  }, [portfolioId]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/import/analytics/tax/${portfolioId}`), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Failed to load tax data');
      }
    } catch (err) {
      setError('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-4">Tax Snapshot (FY2025-26)</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm">LTCG Gains</p>
            <p className="text-2xl font-bold text-green-400">₹{data.ltcg_gains.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm">STCG Gains</p>
            <p className="text-2xl font-bold text-green-400">₹{data.stcg_gains.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm">Exemption Remaining</p>
            <p className="text-2xl font-bold text-blue-400">₹{data.ltcg_exemption_remaining.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-red-900/20 p-4 rounded-lg border border-red-700">
            <p className="text-slate-400 text-sm">Estimated Tax</p>
            <p className="text-2xl font-bold text-red-400">₹{data.total_estimated_tax.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Exemption Status</h4>
          <div className="flex justify-between items-center mb-2">
            <p className="text-slate-400 text-sm">₹1,25,000 Limit</p>
            <p className="text-slate-400 text-sm">{Math.round((data.ltcg_exemption_used / data.ltcg_exemption_limit) * 100)}% used</p>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full"
              style={{ width: `${Math.min(100, (data.ltcg_exemption_used / data.ltcg_exemption_limit) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RiskHealthCard({ portfolioId }: AnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAnalytics();
  }, [portfolioId]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/import/analytics/risk/${portfolioId}`), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Failed to load risk data');
      }
    } catch (err) {
      setError('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  const getDiversificationColor = (score: number) => {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-blue-400';
    if (score >= 25) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-4">Risk & Portfolio Health</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm">Long-term Holdings</p>
            <p className="text-2xl font-bold text-white">{data.long_term_qty_pct.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm">Diversification Score</p>
            <p className={`text-2xl font-bold ${getDiversificationColor(data.diversification_score)}`}>
              {data.diversification_score.toFixed(0)}
            </p>
          </div>
        </div>

        {data.holdings_below_52w_high.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700 p-4 rounded-lg">
            <p className="text-yellow-400 font-medium mb-3">⚠️ Holdings Below 52w High</p>
            <div className="space-y-2">
              {data.holdings_below_52w_high.map((holding: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <p className="text-slate-300">{holding.symbol}</p>
                  <p className="text-yellow-400">{holding.pct_below.toFixed(1)}% below</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ValuationMetricsCard({ portfolioId }: AnalyticsProps) {
  const [data, setData] = useState<ValuationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAnalytics();
  }, [portfolioId]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/import/analytics/valuation/${portfolioId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Failed to load valuation metrics');
      }
    } catch (err) {
      setError('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-4">Valuation Metrics</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-lg bg-slate-800/50 p-4">
            <p className="text-sm text-slate-400">Portfolio PE</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {data.portfolio_pe !== null ? data.portfolio_pe.toFixed(2) : 'N/A'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <p className="text-sm text-slate-400">Forward PE</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {data.portfolio_forward_pe !== null ? data.portfolio_forward_pe.toFixed(2) : 'N/A'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <p className="text-sm text-slate-400">Benchmark PE</p>
            <p className="mt-1 text-2xl font-bold text-blue-400">{data.benchmark_pe.toFixed(2)}</p>
          </div>
        </div>

        {data.holdings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 p-4 text-sm text-slate-400">
            Valuation metrics are ready, but your imported instruments do not have PE data yet.
          </div>
        ) : (
          <div className="space-y-3">
            {data.holdings.map((holding) => (
              <div
                key={holding.symbol}
                className="flex items-center justify-between rounded-lg bg-slate-800/40 p-4"
              >
                <div>
                  <p className="font-medium text-white">{holding.symbol}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(holding.value)} invested in valuation mix</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-300">
                    PE: {holding.pe !== null ? holding.pe.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-sm text-slate-400">
                    Forward: {holding.forward_pe !== null ? holding.forward_pe.toFixed(2) : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function GrowthForecastCard({ portfolioId }: AnalyticsProps) {
  const [data, setData] = useState<GrowthForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAnalytics();
  }, [portfolioId]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/import/analytics/growth/${portfolioId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Failed to load growth forecast');
      }
    } catch (err) {
      setError('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  return (
    <Card>
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Growth Forecast</h3>
            <p className="mt-1 text-sm text-slate-400">Target-price and estimate view for imported holdings</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 px-4 py-3 text-right">
            <p className="text-xs text-slate-400">Average Target Upside</p>
            <p className={`text-xl font-bold ${data.avg_target_upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.avg_target_upside.toFixed(2)}%
            </p>
          </div>
        </div>

        {data.holdings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 p-4 text-sm text-slate-400">
            Growth forecast is ready, but your imported instruments do not have target-price or analyst growth data yet.
          </div>
        ) : (
          <div className="space-y-3">
            {data.holdings.map((holding) => (
              <div
                key={holding.symbol}
                className="rounded-lg bg-slate-800/40 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{holding.symbol}</p>
                    <p className="text-xs text-slate-400">
                      Current {formatCurrency(holding.current_price)}
                      {holding.target_price !== null ? ` • Target ${formatCurrency(holding.target_price)}` : ' • Target N/A'}
                    </p>
                  </div>
                  <p className={`text-lg font-semibold ${holding.upside_downside_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {holding.upside_downside_pct.toFixed(2)}%
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-900/50 p-3">
                    <p className="text-slate-400">EPS Growth</p>
                    <p className="mt-1 text-white">
                      {holding.eps_growth !== null ? `${holding.eps_growth.toFixed(2)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-900/50 p-3">
                    <p className="text-slate-400">Revenue Growth</p>
                    <p className="mt-1 text-white">
                      {holding.revenue_growth !== null ? `${holding.revenue_growth.toFixed(2)}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
