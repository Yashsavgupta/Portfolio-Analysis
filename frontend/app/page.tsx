import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-3xl border border-slate-700 bg-slate-900/80 p-10 shadow-xl shadow-slate-900/30">
          <h1 className="text-4xl font-semibold">Portfolio Evaluator</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Track imported holdings, compare performance against market indices, and review portfolio analytics in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/login" className="rounded-full bg-slate-100 px-5 py-3 text-slate-950 transition hover:bg-slate-200">
              Login
            </Link>
            <Link href="/signup" className="rounded-full border border-slate-600 px-5 py-3 text-slate-100 transition hover:border-slate-400">
              Sign Up
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8">
            <h2 className="text-2xl font-semibold">Portfolio Dashboard</h2>
            <p className="mt-3 text-slate-400">Review total portfolio value, benchmark-relative performance, sector mix, and actionable holding signals.</p>
          </section>
          <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8">
            <h2 className="text-2xl font-semibold">Integrations</h2>
            <p className="mt-3 text-slate-400">Upload Zerodha holdings exports, store API credentials, and connect your brokerage account for live data.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
