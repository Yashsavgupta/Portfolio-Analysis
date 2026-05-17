'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const NAV = [
  {
    href: '/portfolio/total',
    label: 'Total Portfolio',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/portfolio/stocks',
    label: 'Stocks',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href: '/portfolio/mutual-funds',
    label: 'Mutual Funds',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 3v9l4 4" />
      </svg>
    ),
  },
];

const IMPORT = [
  {
    href: '/import?type=holdings',
    label: 'Import Holdings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    href: '/import?type=tradebook',
    label: 'Import Tradebook',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: '/import?type=cas',
    label: 'Import CAS',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function linkClass(href: string) {
    const [base, query] = href.split('?');
    const typeParam = query ? new URLSearchParams(query).get('type') : null;
    const active = typeParam
      ? pathname === base && searchParams.get('type') === typeParam
      : pathname === href || (href !== '/portfolio/total' && pathname.startsWith(href));
    return active
      ? 'flex items-center gap-3 rounded-lg bg-slate-800/80 px-3 py-2.5 text-sm font-medium text-white'
      : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800/40 hover:text-slate-200';
  }

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <nav className="sticky top-14 flex flex-col gap-1 border-r border-slate-800/60 bg-[#080e1a] px-3 py-5" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Portfolio</p>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <span className="shrink-0 opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <div className="my-4 border-t border-slate-800/60" />

        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Import</p>
        {IMPORT.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <span className="shrink-0 opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
