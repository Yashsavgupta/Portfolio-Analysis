'use client';

import HoldingsUpload from '@/components/holdings/HoldingsUpload';
import MutualFundUpload from '@/components/holdings/MutualFundUpload';

export default function ImportMutualFundsPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Import Holdings</h1>
          <p className="mt-2 text-slate-400">
            Import your portfolio holdings from Zerodha or mutual funds from INDmoney.
          </p>
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <HoldingsUpload />
          <MutualFundUpload />
        </div>

        <div className="mt-12 rounded-3xl border border-slate-700 bg-slate-900/80 p-8">
          <h2 className="text-2xl font-semibold mb-4">How to Export from INDmoney</h2>
          <ol className="space-y-3 text-slate-300 list-decimal list-inside">
            <li>Log in to INDmoney and navigate to your mutual fund holdings.</li>
            <li>Use the export or download option to save a CSV of your holdings.</li>
            <li>Return here and choose the CSV file to upload under the INDmoney import panel.</li>
            <li>Assign a portfolio name and view the imported mutual fund analysis.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
