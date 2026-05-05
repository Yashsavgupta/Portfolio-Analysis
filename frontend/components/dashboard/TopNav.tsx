export default function TopNav() {
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-slate-700 bg-slate-900/80 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Portfolio Evaluator</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-100">Dashboard</h2>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm text-slate-300">
        User placeholder
      </div>
    </div>
  );
}
