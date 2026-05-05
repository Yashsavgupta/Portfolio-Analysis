export default function KpiCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {['Total value', 'Return', 'Volatility'].map((label) => (
        <div key={label} className="rounded-3xl border border-slate-700 bg-slate-950/40 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-4 text-3xl font-semibold text-slate-100">Placeholder</p>
        </div>
      ))}
    </div>
  );
}
