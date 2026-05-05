import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children?: ReactNode;
}

export default function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-950/40 p-6">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <div className="mt-4 min-h-[220px] text-slate-400">{children ?? 'Chart placeholder'}</div>
    </div>
  );
}
