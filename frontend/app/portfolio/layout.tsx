'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import Sidebar from '@/components/dashboard/Sidebar';

const TOP_NAV = [
  { href: '/portfolio/total', label: 'Overview' },
  { href: '/portfolio/stocks', label: 'Stocks' },
  { href: '/portfolio/mutual-funds', label: 'Funds' },
  { href: '/import?type=holdings', label: 'Import' },
];

function PortfolioLayoutContent({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  function topNavClass(href: string) {
    const base = href.split('?')[0];
    const active = pathname === base || (base !== '/portfolio/total' && base !== '/import' && pathname.startsWith(base))
      || (base === '/import' && pathname.startsWith('/import'));
    return active
      ? 'border-b-2 border-sky-500 pb-[11px] text-sm font-medium text-sky-400 whitespace-nowrap'
      : 'border-b-2 border-transparent pb-[11px] text-sm font-medium text-slate-500 transition hover:text-slate-300 whitespace-nowrap';
  }

  return (
    <div className="min-h-screen bg-[#080e1a] text-slate-100">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-[#080e1a]/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-5">
          <Link href="/portfolio/total" className="flex shrink-0 items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="36" height="36" rx="8" fill="url(#top-grad)" />
              <polyline points="5,27 12,18 19,22 31,9" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="31" cy="9" r="2.2" fill="white" />
              <defs>
                <linearGradient id="top-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0ea5e9" />
                  <stop offset="1" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-sm font-semibold tracking-tight text-slate-100">Portfolio Evaluator</span>
          </Link>

          {/* Inline nav for non-xl screens */}
          <nav className="mx-6 hidden items-end gap-6 self-stretch sm:flex xl:hidden">
            {TOP_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={topNavClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            {user && (
              <span className="hidden text-xs text-slate-500 xl:block">{user.full_name || user.email}</span>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav row (xs only) */}
        <nav className="flex gap-5 overflow-x-auto px-5 sm:hidden">
          {TOP_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={topNavClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">{children}</main>
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
