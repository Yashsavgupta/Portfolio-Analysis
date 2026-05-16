import Link from 'next/link';

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="9" fill="url(#lm-grad)" />
      <polyline points="5,27 12,18 19,22 31,9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="9" r="2.2" fill="white" />
      <defs>
        <linearGradient id="lm-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const FEATURES = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Portfolio Dashboard',
    description: 'Unified view of your stocks and mutual funds with real-time valuation, sector allocation, and position-level signals.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Benchmark Analysis',
    description: 'Compare portfolio returns against NIFTY 50 and other indices. Identify alpha and understand what drives your performance.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Deep Analytics',
    description: 'Per-portfolio analytics with risk metrics, concentration analysis, and holding-level decision support.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    title: 'Easy Imports',
    description: 'Upload Zerodha holdings exports or INDmoney mutual fund CSVs. Your data stays private — no broker login required.',
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07112c] text-slate-100">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-[600px] w-[700px] -translate-x-1/2 rounded-full bg-teal-500/[0.07] blur-3xl" />
        <div className="absolute top-20 right-[10%] h-80 w-80 rounded-full bg-sky-500/[0.06] blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="text-base font-semibold tracking-tight text-slate-100">Portfolio Evaluator</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-slate-100"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-20 text-center sm:px-10 sm:pt-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-3.5 py-1.5 text-xs font-medium text-teal-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400" />
          Personal wealth dashboard
        </div>

        <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl sm:leading-tight lg:text-6xl lg:leading-tight">
          Track, analyze{' '}
          <span className="bg-gradient-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">
            &amp; grow
          </span>{' '}
          your portfolio
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-slate-400 sm:text-lg">
          One dashboard for all your Zerodha stocks and mutual fund holdings. Compare against benchmarks, spot risks, and make confident decisions.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
          >
            Create free account
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 sm:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm transition hover:border-slate-700"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-300">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-slate-100">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
