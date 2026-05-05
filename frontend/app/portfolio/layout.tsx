'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import Sidebar from '@/components/dashboard/Sidebar';

const PAGE_COPY: Record<string, { title: string; description: string }> = {
  '/portfolio/total': {
    title: 'Total Portfolio',
    description: 'Full portfolio view with benchmark context, risk, valuation, and position-level decision support.',
  },
  '/portfolio/stocks': {
    title: 'Stocks',
    description: 'Dedicated equity view for sector balance, position sizing, and stock-specific signal review.',
  },
  '/portfolio/mutual-funds': {
    title: 'Mutual Funds',
    description: 'Focused mutual fund view for value, daily movement, and allocation review.',
  },
};

function PortfolioLayoutContent({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const pageCopy = PAGE_COPY[pathname] ?? {
    title: 'Portfolio Workspace',
    description: 'Review holdings, imports, and market-linked portfolio analytics.',
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 xl:px-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5 shadow-xl shadow-slate-950/20 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.3em] text-teal-300">Portfolio Workspace</div>
              <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{pageCopy.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">{pageCopy.description}</p>
              {user ? (
                <div className="mt-4 inline-flex max-w-full items-center rounded-full border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                  <span className="truncate">{`Signed in as ${user.full_name} (${user.email})`}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/import-mutual-funds"
                className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Import Holdings
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <Sidebar />
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <PortfolioLayoutContent>{children}</PortfolioLayoutContent>
    </ProtectedRoute>
  );
}
