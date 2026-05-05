'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ZerodhaConnectButton from './ZerodhaConnectButton';

const NAV_ITEMS = [
  { href: '/portfolio/total', label: 'Total Portfolio' },
  { href: '/portfolio/stocks', label: 'Stocks' },
  { href: '/portfolio/mutual-funds', label: 'Mutual Funds' },
];

function navLinkClasses(isActive: boolean) {
  if (isActive) {
    return 'border-sky-400/40 bg-sky-500/10 text-sky-100 shadow-sm shadow-sky-950/30';
  }

  return 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80 hover:text-slate-100';
}

export default function Sidebar() {
  const pathname = usePathname();
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/zerodha/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  return (
    <aside className="w-full xl:sticky xl:top-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl shadow-slate-950/20">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Navigate</div>
        <nav className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${navLinkClasses(isActive)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-slate-800 pt-6">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Broker Connection</div>
          {status ? (
            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                status.connected
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status.connected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {status.connected ? 'Zerodha Connected' : 'Zerodha Not Connected'}
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <ZerodhaConnectButton />
            <Link
              href="/zerodha-api-keys"
              className="block rounded-full border border-slate-700 bg-transparent px-4 py-3 text-center text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              Manage API Keys
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
