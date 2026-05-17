'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Overview', href: '/portfolio/mutual-funds' },
  { label: 'Allocation', href: '/portfolio/mutual-funds/allocation' },
  { label: 'Performance', href: '/portfolio/mutual-funds/performance' },
  { label: 'Tax Planner', href: '/portfolio/mutual-funds/tax' },
  { label: 'Risk', href: '/portfolio/mutual-funds/risk' },
];

export default function MFNavTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-800/60">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 pb-3 text-sm font-medium transition whitespace-nowrap border-b-2 ${
              active
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
