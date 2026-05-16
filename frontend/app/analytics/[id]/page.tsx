'use client';

import { useParams } from 'next/navigation';
import {
  PortfolioOverviewCard,
  SectorSegmentationCard,
  TaxSnapshotCard,
  RiskHealthCard,
  ValuationMetricsCard,
  GrowthForecastCard,
} from '@/components/analytics/AnalyticsCards';
import Card from '@/components/ui/Card';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function AnalyticsDashboard() {
  const params = useParams();
  const portfolioId = parseInt(params.id as string);

  return (
    <ProtectedRoute>
      <AnalyticsDashboardContent portfolioId={portfolioId} />
    </ProtectedRoute>
  );
}

function AnalyticsDashboardContent({ portfolioId }: { portfolioId: number }) {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold">Portfolio Analytics</h1>
          <p className="mt-2 text-slate-400">Comprehensive analysis of your portfolio</p>
        </div>

        {/* Overview Cards */}
        <div className="mb-8">
          <PortfolioOverviewCard portfolioId={portfolioId} />
        </div>

        {/* Main Analytics Views */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Sector Segmentation */}
          <SectorSegmentationCard portfolioId={portfolioId} />

          {/* Risk & Health */}
          <RiskHealthCard portfolioId={portfolioId} />
        </div>

        {/* Tax Snapshot */}
        <div className="mb-8">
          <TaxSnapshotCard portfolioId={portfolioId} />
        </div>

        {/* Coming Soon */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ValuationMetricsCard portfolioId={portfolioId} />

          <GrowthForecastCard portfolioId={portfolioId} />

          <Card>
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-2">Promoter & Institutional</h3>
              <p className="text-slate-400">Promoter holdings and pledge information</p>
              <div className="mt-4 text-slate-500">Coming soon...</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
