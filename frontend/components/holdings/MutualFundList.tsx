'use client';

import { formatCurrency, formatPercent } from '@/lib/format';

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

interface MutualFundListProps {
  holdings: MFHolding[];
}

export default function MutualFundList({ holdings }: MutualFundListProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Mutual Fund Holdings</h2>
            <p className="mt-1 text-sm text-slate-400">Review holdings, NAV, gain/loss, and holding duration.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3">Fund</th>
                <th className="px-4 py-3">House</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-right">Current NAV</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Gain / Loss</th>
                <th className="px-4 py-3 text-right">Holding</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={holding.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-100 font-medium">{holding.fund_name}</td>
                  <td className="px-4 py-3">{holding.fund_house}</td>
                  <td className="px-4 py-3 text-right">{holding.units.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(holding.current_nav)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(holding.cost_basis)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(holding.current_value)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${holding.gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(holding.gain_loss)}
                    <span className="ml-2 text-xs text-slate-400">{formatPercent(holding.gain_loss_pct)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div>{holding.holding_days ?? '-'}d</div>
                    <div className="text-xs text-slate-500">{holding.is_long_term ? 'LT' : 'ST'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
