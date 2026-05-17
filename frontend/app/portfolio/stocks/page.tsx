import PortfolioDashboard from '@/components/portfolio/PortfolioDashboard';
import StocksNavTabs from '@/components/stocks/StocksNavTabs';

export default function StocksPage() {
  return (
    <div className="space-y-0">
      <StocksNavTabs />
      <PortfolioDashboard />
    </div>
  );
}
