'use client';

import HoldingsUpload from '@/components/holdings/HoldingsUpload';

export default function ImportMutualFundsPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Import Holdings</h1>
          <p className="mt-2 text-slate-400">Upload your Zerodha holdings export to analyze your portfolio</p>
        </div>
        
        <HoldingsUpload />
        
        <div className="mt-12 rounded-3xl border border-slate-700 bg-slate-900/80 p-8">
          <h2 className="text-2xl font-semibold mb-4">How to Export from Zerodha</h2>
          <ol className="space-y-3 text-slate-300 list-decimal list-inside">
            <li>Log in to Zerodha Holdings (https://holdings.zerodha.com)</li>
            <li>Click on the Holdings menu</li>
            <li>Look for the download button (usually in the top right)</li>
            <li>Select Download as Excel and save the .xlsx file</li>
            <li>Upload the file using the form above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
