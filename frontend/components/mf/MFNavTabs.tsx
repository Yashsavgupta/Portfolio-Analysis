'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Overview', href: '/portfolio/mutual-funds' },
  { label: 'Allocation', href: '/portfolio/mutual-funds/allocation' },
  { label: 'Performance', href: '/portfolio/mutual-funds/performance' },
  { label: 'Tax Planner', href: '/portfolio/mutual-funds/tax' },
  { label: 'Risk', href: '/portfolio/mutual-funds/risk' },
  { label: 'Search Funds', href: '/portfolio/mutual-funds/search' },
];

export default function MFNavTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-1.5">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
              active
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
