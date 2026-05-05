'use client';

import Card from '@/components/ui/Card';
import { formatCurrency, formatPercent } from '@/lib/format';

interface MFSummary {
  total_invested: number;
  total_value: number;
  total_gain_loss: number;
  total_gain_loss_pct: number;
  num_funds: number;
  by_category: Record<string, any>;
  by_house: Record<string, any>;
}

interface MutualFundSummaryProps {
  summary: MFSummary;
}

export default function MutualFundSummary({ summary }: MutualFundSummaryProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total Invested</div>
        <div className="mt-3 text-3xl font-semibold text-slate-100">{formatCurrency(summary.total_invested)}</div>
      </Card>
      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Current Value</div>
        <div className="mt-3 text-3xl font-semibold text-slate-100">{formatCurrency(summary.total_value)}</div>
      </Card>
      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total Gain / Loss</div>
        <div className={`mt-3 text-3xl font-semibold ${summary.total_gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCurrency(summary.total_gain_loss)}
        </div>
        <div className="mt-2 text-sm text-slate-400">{formatPercent(summary.total_gain_loss_pct)}</div>
      </Card>
      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Funds Held</div>
        <div className="mt-3 text-3xl font-semibold text-slate-100">{summary.num_funds}</div>
      </Card>
    </div>
  );
}
