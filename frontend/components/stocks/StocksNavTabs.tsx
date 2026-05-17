'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Overview', href: '/portfolio/stocks' },
  { label: 'Performance & XIRR', href: '/portfolio/stocks/performance' },
  { label: 'Realized P&L', href: '/portfolio/stocks/pnl' },
  { label: 'Tax', href: '/portfolio/stocks/tax' },
  { label: 'Trades', href: '/portfolio/stocks/trades' },
];

export default function StocksNavTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-0.5 overflow-x-auto border-b border-slate-800/60 pb-0">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition -mb-px ${
              isActive
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
