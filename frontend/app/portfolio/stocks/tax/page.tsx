'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StocksNavTabs from '@/components/stocks/StocksNavTabs';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { formatCurrency } from '@/lib/format';

interface Summary {
  total_realized: number;
  ltcg_gain: number;
  stcg_gain: number;
  ltcg_taxable: number;
  ltcg_tax: number;
  stcg_tax: number;
  total_estimated_tax: number;
}

interface Lot {
  symbol: string;
  tax_category: 'LTCG' | 'STCG';
  realized_gain: number;
  holding_days: number;
  buy_date: string;
  sell_date: string;
  quantity: number;
  buy_price: number;
  sell_price: number;
}

interface StockPerf {
  symbol: string;
  unrealized_gain: number;
  holding_days: number;
  invested: number;
  current_value: number;
}

function gainColor(v: number) {
  return v >= 0 ? 'text-emerald-400' : 'text-red-400';
}

export default function StocksTaxPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [perStock, setPerStock] = useState<StockPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [noTrades, setNoTrades] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/portfolios/realized-pnl'), { headers: getAuthHeaders() as HeadersInit }).then((r) => r.json()),
      fetch(apiUrl('/api/portfolios/trade-analysis'), { headers: getAuthHeaders() as HeadersInit }).then((r) => r.json()),
    ])
      .then(([pnl, analysis]) => {
        if (pnl.no_trades) { setNoTrades(true); return; }
        setSummary(pnl.summary);
        setLots(pnl.lots);
        setPerStock(analysis.per_stock ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Harvest candidates: unrealized losers that could offset gains
  const harvestCandidates = perStock
    .filter((s) => s.unrealized_gain < -5000)
    .sort((a, b) => a.unrealized_gain - b.unrealized_gain)
    .slice(0, 5);

  // Near-LTCG: open positions between 300-365 days (approaching LTCG threshold)
  const nearLTCG = perStock
    .filter((s) => s.holding_days >= 300 && s.holding_days < 365)
    .sort((a, b) => b.holding_days - a.holding_days);

  const ltcgLots = lots.filter((l) => l.tax_category === 'LTCG');
  const stcgLots = lots.filter((l) => l.tax_category === 'STCG');

  return (
    <div>
      <StocksNavTabs />

          {loading && <div className="h-64 rounded-2xl bg-slate-800 animate-pulse" />}

          {!loading && noTrades && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-10 text-center">
              <h2 className="text-2xl font-semibold">No Tradebook Data</h2>
              <p className="mt-2 text-slate-400">Import your tradebook to see tax analysis.</p>
              <Link href="/import?type=tradebook" className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition">
                Import Tradebook
              </Link>
            </div>
          )}

          {!loading && summary && (
            <>
              {/* Tax rates info */}
              <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 text-sm text-slate-400 flex flex-wrap gap-6">
                <span>FY2024-25 rates (Budget 2024)</span>
                <span>LTCG ({'>'} 1 yr): <strong className="text-slate-200">12.5%</strong> on gains above ₹1L</span>
                <span>STCG (≤ 1 yr): <strong className="text-slate-200">20%</strong></span>
                <span className="text-amber-300 font-medium">Disclaimer: consult your CA for final tax computation</span>
              </div>

              {/* Summary banner */}
              <div className="mb-8 rounded-2xl bg-gradient-to-br from-amber-900/30 to-slate-900 border border-amber-700/40 p-6 flex flex-wrap gap-8 items-center">
                <div>
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Total Estimated Tax</p>
                  <p className="text-4xl font-bold text-amber-400">{formatCurrency(summary.total_estimated_tax)}</p>
                </div>
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-slate-400">Total Realized</p>
                    <p className={`font-semibold text-lg ${gainColor(summary.total_realized)}`}>{formatCurrency(summary.total_realized)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">LTCG Gain</p>
                    <p className={`font-semibold ${gainColor(summary.ltcg_gain)}`}>{formatCurrency(summary.ltcg_gain)}</p>
                    <p className="text-xs text-slate-500">Tax: {formatCurrency(summary.ltcg_tax)} (on {formatCurrency(summary.ltcg_taxable)} above ₹1L)</p>
                  </div>
                  <div>
                    <p className="text-slate-400">STCG Gain</p>
                    <p className={`font-semibold ${gainColor(summary.stcg_gain)}`}>{formatCurrency(summary.stcg_gain)}</p>
                    <p className="text-xs text-slate-500">Tax: {formatCurrency(summary.stcg_tax)}</p>
                  </div>
                </div>
              </div>

              {/* LTCG */}
              {ltcgLots.length > 0 && (
                <div className="mb-6 rounded-2xl border border-emerald-800/30 bg-slate-900/60 overflow-hidden">
                  <div className="bg-emerald-900/20 px-5 py-3 flex items-center gap-2">
                    <span className="rounded-full bg-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-200">LTCG</span>
                    <span className="text-sm font-medium text-slate-200">{ltcgLots.length} lots — {formatCurrency(summary.ltcg_gain)} gain</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                          {['Symbol', 'Qty', 'Buy Date', 'Sell Date', 'Days', 'Buy', 'Sell', 'Gain/Loss'].map((h) => (
                            <th key={h} className="px-4 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ltcgLots.map((l, i) => (
                          <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                            <td className="px-4 py-2 font-medium text-white">{l.symbol}</td>
                            <td className="px-4 py-2 text-slate-300">{l.quantity}</td>
                            <td className="px-4 py-2 text-slate-400">{l.buy_date}</td>
                            <td className="px-4 py-2 text-slate-400">{l.sell_date}</td>
                            <td className="px-4 py-2 text-slate-400">{l.holding_days}d</td>
                            <td className="px-4 py-2 text-slate-300">{formatCurrency(l.buy_price)}</td>
                            <td className="px-4 py-2 text-slate-300">{formatCurrency(l.sell_price)}</td>
                            <td className={`px-4 py-2 font-semibold ${gainColor(l.realized_gain)}`}>
                              {l.realized_gain >= 0 ? '+' : ''}{formatCurrency(l.realized_gain)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STCG */}
              {stcgLots.length > 0 && (
                <div className="mb-6 rounded-2xl border border-amber-800/30 bg-slate-900/60 overflow-hidden">
                  <div className="bg-amber-900/20 px-5 py-3 flex items-center gap-2">
                    <span className="rounded-full bg-amber-800 px-2 py-0.5 text-xs font-medium text-amber-200">STCG</span>
                    <span className="text-sm font-medium text-slate-200">{stcgLots.length} lots — {formatCurrency(summary.stcg_gain)} gain</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                          {['Symbol', 'Qty', 'Buy Date', 'Sell Date', 'Days', 'Buy', 'Sell', 'Gain/Loss'].map((h) => (
                            <th key={h} className="px-4 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stcgLots.map((l, i) => (
                          <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                            <td className="px-4 py-2 font-medium text-white">{l.symbol}</td>
                            <td className="px-4 py-2 text-slate-300">{l.quantity}</td>
                            <td className="px-4 py-2 text-slate-400">{l.buy_date}</td>
                            <td className="px-4 py-2 text-slate-400">{l.sell_date}</td>
                            <td className="px-4 py-2 text-slate-400">{l.holding_days}d</td>
                            <td className="px-4 py-2 text-slate-300">{formatCurrency(l.buy_price)}</td>
                            <td className="px-4 py-2 text-slate-300">{formatCurrency(l.sell_price)}</td>
                            <td className={`px-4 py-2 font-semibold ${gainColor(l.realized_gain)}`}>
                              {l.realized_gain >= 0 ? '+' : ''}{formatCurrency(l.realized_gain)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Near LTCG threshold */}
              {nearLTCG.length > 0 && (
                <div className="mb-6 rounded-2xl border border-blue-800/30 bg-blue-900/10 p-5">
                  <h3 className="font-semibold text-blue-300 mb-3">Approaching LTCG Threshold (300–365 days held)</h3>
                  <p className="text-sm text-slate-400 mb-4">Consider holding these a bit longer to qualify for the 12.5% LTCG rate instead of 20% STCG.</p>
                  <div className="flex flex-wrap gap-3">
                    {nearLTCG.map((s) => (
                      <div key={s.symbol} className="rounded-xl border border-blue-700/30 bg-slate-900 px-4 py-3">
                        <p className="font-semibold text-white">{s.symbol}</p>
                        <p className="text-xs text-slate-400">{s.holding_days}d held · {365 - s.holding_days}d to LTCG</p>
                        <p className={`text-sm font-medium ${gainColor(s.unrealized_gain)}`}>
                          {s.unrealized_gain >= 0 ? '+' : ''}{formatCurrency(s.unrealized_gain)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tax harvesting */}
              {harvestCandidates.length > 0 && (
                <div className="rounded-2xl border border-red-800/30 bg-red-900/10 p-5">
                  <h3 className="font-semibold text-red-300 mb-1">Tax Harvesting Opportunities</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    These open positions have unrealized losses that could offset your STCG/LTCG gains if sold before year-end.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase border-b border-slate-800">
                          {['Symbol', 'Unrealized Loss', 'Days Held', 'Invested', 'Current Value'].map((h) => (
                            <th key={h} className="px-4 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {harvestCandidates.map((s) => (
                          <tr key={s.symbol} className="border-b border-slate-800/40">
                            <td className="px-4 py-2 font-medium text-white">{s.symbol}</td>
                            <td className="px-4 py-2 font-semibold text-red-400">{formatCurrency(s.unrealized_gain)}</td>
                            <td className="px-4 py-2 text-slate-400">{s.holding_days}d</td>
                            <td className="px-4 py-2 text-slate-300">{formatCurrency(s.invested)}</td>
                            <td className="px-4 py-2 text-slate-300">{formatCurrency(s.current_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
    </div>
  );
}
