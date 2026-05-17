'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

type ImportType = 'holdings' | 'tradebook' | 'cas' | null;
type Step = 1 | 2 | 3 | 4;

interface PreviewData {
  file_type: string;
  broker: string;
  unrecognised: boolean;
  raw_headers: string[];
  stocks_count: number;
  mutual_funds_count: number;
  total_rows: number;
  date_from: string | null;
  date_to: string | null;
  preview: Record<string, any>[];
}

interface ImportResult {
  status?: string;
  file_type?: string;
  broker?: string;
  message?: string;
  // Holdings
  portfolio_id?: number;
  portfolio_name?: string;
  stocks_imported?: number;
  mutual_funds_in_file?: number;
  mf_portfolio_id?: number;
  mf_portfolio_name?: string;
  mf_funds_imported?: number;
  // Tradebook
  new_trades_added?: number;
  duplicates_skipped?: number;
  total_trades?: number;
  file_date_range?: { from: string | null; to: string | null };
  existing_date_range?: { from: string | null; to: string | null };
  merged_date_range?: { from: string | null; to: string | null };
  gaps?: { from: string; to: string; days: number; note: string }[];
}

interface CasPreview {
  source: string;
  total_rows: number;
  skipped_rows: number;
  date_from: string | null;
  date_to: string | null;
  funds: string[];
  preview: Record<string, any>[];
  raw_headers: string[];
}

interface CasResult {
  new_added: number;
  duplicates_skipped: number;
  total_stored: number;
  source: string;
  date_from: string | null;
  date_to: string | null;
  funds_count: number;
  funds: string[];
}

const BROKER_LABELS: Record<string, string> = {
  zerodha: 'Zerodha',
  groww: 'Groww',
  upstox: 'Upstox',
  angel_one: 'Angel One',
  hdfc_securities: 'HDFC Securities',
  kuvera: 'Kuvera',
  unknown: 'Unknown Broker',
};

function brokerLabel(b: string) {
  return BROKER_LABELS[b] || b;
}

function StepDot({ n, current }: { n: number; current: Step }) {
  const done = n < current;
  const active = n === current;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
          done ? 'bg-emerald-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
        }`}
      >
        {done ? '✓' : n}
      </div>
      {n < 4 && <div className={`h-px w-10 ${n < current ? 'bg-emerald-600' : 'bg-slate-700'}`} />}
    </div>
  );
}

export default function ImportPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [importType, setImportType] = useState<ImportType>(null);

  // Auto-advance to Step 2 when ?type= is in the URL
  useEffect(() => {
    const type = searchParams.get('type') as ImportType;
    if (type === 'holdings' || type === 'tradebook' || type === 'cas') {
      setImportType(type);
      setStep(2);
    }
  }, [searchParams]);
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [casPreview, setCasPreview] = useState<CasPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [casResult, setCasResult] = useState<CasResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      setPreviewError('Please upload a CSV file. To export from your broker: use the "Download CSV" or "Export CSV" option (not Excel).');
      return;
    }
    setFile(f);
    setPreview(null);
    setPreviewError(null);
    setResult(null);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const runPreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      if (importType === 'cas') {
        const res = await fetch(apiUrl('/api/mutual-funds/import/cas/preview'), {
          method: 'POST', headers, body: form,
        });
        const data = await res.json().catch(() => ({ detail: `Server error (${res.status})` }));
        if (!res.ok) throw new Error(data.detail || 'Preview failed');
        setCasPreview(data);
      } else {
        const res = await fetch(apiUrl('/api/import/preview'), {
          method: 'POST', headers, body: form,
        });
        const data = await res.json().catch(() => ({ detail: `Server error (${res.status})` }));
        if (!res.ok) throw new Error(data.detail || 'Preview failed');
        setPreview(data);
        if (importType && data.file_type !== importType) {
          setImportType(data.file_type as ImportType);
        }
      }
      setStep(3);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      if (importType === 'cas') {
        const res = await fetch(apiUrl('/api/mutual-funds/import/cas/confirm'), {
          method: 'POST', headers, body: form,
        });
        const data = await res.json().catch(() => ({ detail: `Server error (${res.status})` }));
        if (!res.ok) throw new Error(data.detail || 'Import failed');
        setCasResult(data);
      } else {
        const res = await fetch(apiUrl('/api/import/universal'), {
          method: 'POST', headers, body: form,
        });
        const data = await res.json().catch(() => ({ detail: `Server error (${res.status})` }));
        if (!res.ok) throw new Error(data.detail || 'Import failed');
        setResult(data);
      }
      setStep(4);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setImportType(null);
    setFile(null);
    setPreview(null);
    setCasPreview(null);
    setPreviewError(null);
    setResult(null);
    setCasResult(null);
    setImportError(null);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold">Import Data</h1>
            <p className="mt-2 text-slate-400">
              Import your holdings or trade history from any broker. Works with Zerodha, Groww,
              Upstox, Angel One, HDFC Securities, Kuvera, and more.
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8 flex items-center">
            {[1, 2, 3, 4].map((n) => (
              <StepDot key={n} n={n} current={step} />
            ))}
            <div className="ml-4 text-sm text-slate-400">
              {step === 1 && 'Choose what to import'}
              {step === 2 && 'Upload your file'}
              {step === 3 && 'Preview & confirm'}
              {step === 4 && 'Done!'}
            </div>
          </div>

          {/* ── Step 1: Choose type ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  type: 'holdings' as ImportType,
                  title: 'Holdings',
                  subtitle: 'Current positions',
                  desc: 'A snapshot of what you hold right now — quantity, average cost, and current value. Download from your broker\'s portfolio or holdings page.',
                  icon: '📊',
                },
                {
                  type: 'tradebook' as ImportType,
                  title: 'Tradebook',
                  subtitle: 'Stock trade history',
                  desc: 'Every stock buy and sell you\'ve ever made. Used to compute XIRR, realized P&L, and tax. Import multiple files to build a complete history.',
                  icon: '📋',
                },
                {
                  type: 'cas' as ImportType,
                  title: 'MF Transactions',
                  subtitle: 'CAS / SIP history',
                  desc: 'Every mutual fund SIP, lump sum, and redemption. Enables accurate XIRR for SIP investors. Export from CAMS, KFintech, Kuvera, or Groww.',
                  icon: '📈',
                },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { setImportType(opt.type); setStep(2); }}
                  className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-left transition hover:border-blue-500 hover:bg-slate-900"
                >
                  <div className="text-4xl mb-3">{opt.icon}</div>
                  <div className="font-bold text-xl text-white">{opt.title}</div>
                  <div className="text-sm text-blue-400 mb-2">{opt.subtitle}</div>
                  <div className="text-sm text-slate-400">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Upload file ─────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} className="mb-4 text-sm text-slate-400 hover:text-slate-200">
                ← Back
              </button>

              {/* How-to for selected type */}
              <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
                {importType === 'holdings' ? (
                  <>
                    <p className="font-semibold text-slate-200 mb-2">How to export your holdings</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><strong className="text-slate-300">Zerodha:</strong> Console → Portfolio → Holdings → Download</li>
                      <li><strong className="text-slate-300">Groww:</strong> Portfolio → Holdings → Export CSV</li>
                      <li><strong className="text-slate-300">Upstox:</strong> Portfolio → Download as Excel</li>
                      <li><strong className="text-slate-300">Angel One:</strong> Portfolio → Holdings → Download</li>
                      <li><strong className="text-slate-300">Kuvera:</strong> Reports → Portfolio Valuation → Export</li>
                    </ul>
                  </>
                ) : importType === 'cas' ? (
                  <>
                    <p className="font-semibold text-slate-200 mb-2">How to get your MF transaction history</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><strong className="text-slate-300">CAMS:</strong> myams.com → Mailback Services → Detailed Account Statement → CSV</li>
                      <li><strong className="text-slate-300">KFintech:</strong> kfintech.com → Investor Services → Account Statement → Download CSV</li>
                      <li><strong className="text-slate-300">MFCentral:</strong> mfcentral.com → Consolidated Account Statement</li>
                      <li><strong className="text-slate-300">Kuvera:</strong> Portfolio → Transaction History → Export CSV</li>
                      <li><strong className="text-slate-300">Groww:</strong> Mutual Funds → Transaction History → Download</li>
                    </ul>
                    <p className="mt-3 text-sky-400 text-xs">
                      This gives you accurate SIP-based XIRR instead of the holdings approximation. Duplicates are automatically skipped on re-import.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-200 mb-2">How to export your tradebook</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><strong className="text-slate-300">Zerodha:</strong> Console → Reports → Tradebook → Download CSV</li>
                      <li><strong className="text-slate-300">Groww:</strong> Portfolio → P&L → Download</li>
                      <li><strong className="text-slate-300">Upstox:</strong> Reports → Trade History → Export</li>
                      <li><strong className="text-slate-300">Angel One:</strong> Reports → Trade Book → Download</li>
                    </ul>
                    <p className="mt-3 text-amber-400 text-xs">
                      Tip: If your history spans multiple years, download each year separately and import them one by one. Duplicates are automatically skipped.
                    </p>
                  </>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-10 text-center transition hover:border-blue-500 hover:bg-slate-900/70"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div>
                    <p className="text-lg font-medium text-blue-300">{file.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB — click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-3">📂</p>
                    <p className="text-lg font-medium text-slate-300">Drop your file here or click to browse</p>
                    <p className="mt-1 text-sm text-slate-500">CSV files only (.csv)</p>
                  </div>
                )}
              </div>

              {previewError && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-300 text-sm">
                  {previewError}
                </div>
              )}

              <button
                onClick={runPreview}
                disabled={!file || previewing}
                className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previewing ? 'Detecting broker & parsing...' : 'Preview Import →'}
              </button>
            </div>
          )}

          {/* ── Step 3: CAS Preview ─────────────────────────────────────────── */}
          {step === 3 && importType === 'cas' && casPreview && (
            <div>
              <button onClick={() => setStep(2)} className="mb-4 text-sm text-slate-400 hover:text-slate-200">← Back</button>
              <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="rounded-full bg-emerald-900/50 border border-emerald-700 px-3 py-1 text-sm text-emerald-300">
                    ✓ {casPreview.source.replace('cas_', '').replace('_', ' ').toUpperCase()} format detected
                  </span>
                  <span className="rounded-full bg-purple-900/50 border border-purple-700 px-3 py-1 text-sm text-purple-300">
                    MF Transactions
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                    <p className="text-2xl font-bold text-white">{casPreview.total_rows}</p>
                    <p className="text-xs text-slate-400">Transactions</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                    <p className="text-2xl font-bold text-purple-300">{casPreview.funds.length}</p>
                    <p className="text-xs text-slate-400">Funds</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-300">{casPreview.date_from}</p>
                    <p className="text-xs text-slate-500">to</p>
                    <p className="text-xs font-semibold text-slate-300">{casPreview.date_to}</p>
                    <p className="text-xs text-slate-400">Date range</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                    <p className="text-2xl font-bold text-slate-400">{casPreview.skipped_rows}</p>
                    <p className="text-xs text-slate-400">Skipped rows</p>
                  </div>
                </div>
              </div>

              {/* Preview table */}
              {casPreview.preview.length > 0 && (
                <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
                  <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-800">
                    Preview (first {casPreview.preview.length} transactions)
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase">
                        {Object.keys(casPreview.preview[0]).map(k => (
                          <th key={k} className="px-3 py-2 text-left whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {casPreview.preview.map((row, i) => (
                        <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                          {Object.entries(row).map(([k, v]) => (
                            <td key={k} className={`px-3 py-2 whitespace-nowrap ${
                              k === 'type'
                                ? v === 'buy' ? 'text-emerald-400' : v === 'sell' ? 'text-red-400' : 'text-slate-300'
                                : 'text-slate-300'
                            }`}>{String(v ?? '—')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importError && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-300 text-sm">{importError}</div>
              )}
              <button
                onClick={runImport}
                disabled={importing}
                className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Confirm & Import ${casPreview.total_rows} transactions`}
              </button>
            </div>
          )}

          {/* ── Step 3: Holdings/Tradebook Preview ──────────────────────────── */}
          {step === 3 && preview && (
            <div>
              <button onClick={() => setStep(2)} className="mb-4 text-sm text-slate-400 hover:text-slate-200">
                ← Back
              </button>

              {/* Detection summary */}
              <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {preview.unrecognised ? (
                    <span className="rounded-full bg-amber-900/50 border border-amber-700 px-3 py-1 text-sm text-amber-300">
                      ⚠ Broker not recognised
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-900/50 border border-emerald-700 px-3 py-1 text-sm text-emerald-300">
                      ✓ {brokerLabel(preview.broker)} detected
                    </span>
                  )}
                  <span className="rounded-full bg-blue-900/50 border border-blue-700 px-3 py-1 text-sm text-blue-300 capitalize">
                    {preview.file_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                    <p className="text-2xl font-bold text-white">{preview.total_rows}</p>
                    <p className="text-xs text-slate-400">Total rows</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                    <p className="text-2xl font-bold text-blue-300">{preview.stocks_count}</p>
                    <p className="text-xs text-slate-400">Stocks</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                    <p className="text-2xl font-bold text-purple-300">{preview.mutual_funds_count}</p>
                    <p className="text-xs text-slate-400">Mutual Funds</p>
                  </div>
                  {preview.file_type === 'tradebook' && (
                    <div className="rounded-xl bg-slate-800/60 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-300">{preview.date_from}</p>
                      <p className="text-xs text-slate-500">to</p>
                      <p className="text-xs font-semibold text-slate-300">{preview.date_to}</p>
                      <p className="text-xs text-slate-400">Date range</p>
                    </div>
                  )}
                </div>
              </div>

              {preview.unrecognised && (
                <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-900/10 p-4 text-sm text-amber-300">
                  <p className="font-semibold mb-1">Broker format not recognised</p>
                  <p className="text-slate-400">
                    Your file headers don't match any known broker format. You can still try to import — the system will attempt a best-effort parse. For guaranteed accuracy, check that your export is in the standard format.
                  </p>
                  <div className="mt-2 text-xs text-slate-500">
                    Detected headers: {preview.raw_headers.slice(0, 8).join(', ')}
                    {preview.raw_headers.length > 8 ? '...' : ''}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {preview.preview.length > 0 && (
                <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
                  <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-800">
                    Preview (first {preview.preview.length} rows)
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase">
                        {Object.keys(preview.preview[0]).filter(k => k !== 'raw').map((k) => (
                          <th key={k} className="px-3 py-2 text-left whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((row, i) => (
                        <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                          {Object.entries(row).filter(([k]) => k !== 'raw').map(([k, v]) => (
                            <td key={k} className={`px-3 py-2 whitespace-nowrap ${
                              k === 'instrument_type'
                                ? v === 'mutual_fund' ? 'text-purple-400' : 'text-blue-400'
                                : 'text-slate-300'
                            }`}>
                              {String(v ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importError && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-300 text-sm">
                  {importError}
                </div>
              )}

              <button
                onClick={runImport}
                disabled={importing}
                className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Confirm & Import ${preview.total_rows} rows`}
              </button>
            </div>
          )}

          {/* ── Step 4: CAS Result ──────────────────────────────────────────── */}
          {step === 4 && importType === 'cas' && casResult && (
            <div>
              <div className="mb-6 rounded-2xl border border-emerald-700/40 bg-emerald-900/10 p-6">
                <p className="text-2xl font-bold text-emerald-300 mb-1">Import Complete</p>
                <p className="text-slate-400 text-sm">MF transaction history imported successfully.</p>
              </div>

              <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-sm font-semibold text-slate-200 mb-4">Transaction History Coverage</p>
                <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3 mb-3">
                  <span className="text-slate-400">Date range</span>
                  <span className="text-emerald-300 font-mono font-semibold">{casResult.date_from} → {casResult.date_to}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="rounded-lg bg-slate-800 px-3 py-2">
                    <span className="text-emerald-400 font-bold">{casResult.new_added}</span>
                    <span className="text-slate-400 ml-1">new transactions added</span>
                  </div>
                  {casResult.duplicates_skipped > 0 && (
                    <div className="rounded-lg bg-slate-800 px-3 py-2">
                      <span className="text-slate-400 font-bold">{casResult.duplicates_skipped}</span>
                      <span className="text-slate-400 ml-1">duplicates skipped</span>
                    </div>
                  )}
                  <div className="rounded-lg bg-slate-800 px-3 py-2">
                    <span className="text-purple-300 font-bold">{casResult.funds_count}</span>
                    <span className="text-slate-400 ml-1">funds</span>
                  </div>
                  <div className="rounded-lg bg-slate-800 px-3 py-2">
                    <span className="text-slate-200 font-bold">{casResult.total_stored}</span>
                    <span className="text-slate-400 ml-1">total on record</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-xl border border-sky-700/30 bg-sky-900/10 p-4 text-sm text-sky-300">
                Your <strong>Performance &amp; XIRR</strong> tab will now show accurate XIRR calculated from your actual SIP and lump sum history instead of the holdings approximation.
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/portfolio/mutual-funds/performance" className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition">
                  View MF Performance →
                </Link>
                <button onClick={reset} className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800 transition">
                  Import Another File
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Holdings/Tradebook Result ───────────────────────────── */}
          {step === 4 && result && (
            <div>
              <div className="mb-6 rounded-2xl border border-emerald-700/40 bg-emerald-900/10 p-6">
                <p className="text-2xl font-bold text-emerald-300 mb-1">Import Complete</p>
                <p className="text-slate-400 text-sm">{result.message}</p>
                {result.broker && result.broker !== 'unknown' && (
                  <p className="text-xs text-slate-500 mt-1">Source: {brokerLabel(result.broker)}</p>
                )}
              </div>

              {/* Tradebook-specific: date range timeline */}
              {result.file_type === 'tradebook' && result.merged_date_range?.from && (
                <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <p className="text-sm font-semibold text-slate-200 mb-4">Trade History Coverage</p>

                  <div className="space-y-3 text-sm">
                    {result.existing_date_range?.from && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Previous history</span>
                        <span className="text-slate-300 font-mono">
                          {result.existing_date_range.from} → {result.existing_date_range.to}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">This file</span>
                      <span className="text-blue-300 font-mono">
                        {result.file_date_range?.from} → {result.file_date_range?.to}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                      <span className="font-semibold text-slate-200">Total coverage</span>
                      <span className="text-emerald-300 font-mono font-semibold">
                        {result.merged_date_range.from} → {result.merged_date_range.to}
                      </span>
                    </div>
                  </div>

                  {/* Visual timeline bar */}
                  <div className="mt-5">
                    <TimelineBar
                      existing={result.existing_date_range ?? null}
                      newRange={result.file_date_range ?? null}
                      merged={result.merged_date_range}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div className="rounded-lg bg-slate-800 px-3 py-2">
                      <span className="text-emerald-400 font-bold">{result.new_trades_added}</span>
                      <span className="text-slate-400 ml-1">new trades added</span>
                    </div>
                    {(result.duplicates_skipped ?? 0) > 0 && (
                      <div className="rounded-lg bg-slate-800 px-3 py-2">
                        <span className="text-slate-400 font-bold">{result.duplicates_skipped}</span>
                        <span className="text-slate-400 ml-1">duplicates skipped</span>
                      </div>
                    )}
                    <div className="rounded-lg bg-slate-800 px-3 py-2">
                      <span className="text-slate-200 font-bold">{result.total_trades}</span>
                      <span className="text-slate-400 ml-1">total trades</span>
                    </div>
                  </div>

                  {/* Gaps */}
                  {(result.gaps ?? []).length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-900/10 p-4">
                      <p className="text-sm font-semibold text-amber-300 mb-2">
                        ⚠ {result.gaps!.length} gap{result.gaps!.length > 1 ? 's' : ''} detected in your history
                      </p>
                      <div className="space-y-1">
                        {result.gaps!.map((g, i) => (
                          <p key={i} className="text-xs text-slate-400">
                            {g.from} → {g.to} ({g.days} days) — consider importing trades for this period
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Holdings result */}
              {result.file_type === 'holdings' && (
                <div className="mb-6 grid grid-cols-2 gap-3">
                  {(result.stocks_imported ?? 0) > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-300">{result.stocks_imported}</p>
                      <p className="text-xs text-slate-400 mt-1">Stocks imported</p>
                    </div>
                  )}
                  {(result.mf_funds_imported ?? 0) > 0 && (
                    <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/10 p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-300">{result.mf_funds_imported}</p>
                      <p className="text-xs text-slate-400 mt-1">Mutual funds imported</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {result.file_type === 'tradebook' ? (
                  <>
                    <Link href="/portfolio/stocks/performance" className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition">
                      View Performance →
                    </Link>
                    <button onClick={reset} className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800 transition">
                      Import Another File
                    </button>
                  </>
                ) : (
                  <>
                    {(result.stocks_imported ?? 0) > 0 && (
                      <Link href="/portfolio/stocks" className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition">
                        View Stocks →
                      </Link>
                    )}
                    {(result.mf_funds_imported ?? 0) > 0 && (
                      <Link href="/portfolio/mutual-funds" className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-600 transition">
                        View Mutual Funds →
                      </Link>
                    )}
                    <button onClick={reset} className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800 transition">
                      Import Another File
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

// ── Timeline bar sub-component ────────────────────────────────────────────────

function TimelineBar({
  existing,
  newRange,
  merged,
}: {
  existing: { from: string | null; to: string | null } | null;
  newRange: { from: string | null; to: string | null } | null;
  merged: { from: string | null; to: string | null };
}) {
  if (!merged.from || !merged.to) return null;

  const mergedFrom = new Date(merged.from).getTime();
  const mergedTo = new Date(merged.to).getTime();
  const span = mergedTo - mergedFrom || 1;

  function toPercent(dateStr: string) {
    return ((new Date(dateStr).getTime() - mergedFrom) / span) * 100;
  }

  function barStyle(from: string | null, to: string | null, color: string) {
    if (!from || !to) return null;
    const left = toPercent(from);
    const width = toPercent(to) - left;
    return { left: `${left}%`, width: `${Math.max(width, 2)}%`, backgroundColor: color };
  }

  const existingStyle = existing?.from ? barStyle(existing.from, existing.to, '#10b981') : null;
  const newStyle = newRange?.from ? barStyle(newRange.from, newRange.to, '#3b82f6') : null;

  return (
    <div>
      <div className="relative h-6 rounded-full bg-slate-800 overflow-hidden">
        {existingStyle && (
          <div className="absolute h-full rounded-full opacity-70" style={existingStyle} title="Existing history" />
        )}
        {newStyle && (
          <div className="absolute h-full rounded-full opacity-90" style={newStyle} title="This file" />
        )}
      </div>
      <div className="flex justify-between mt-1 text-xs text-slate-500">
        <span>{merged.from}</span>
        <span>{merged.to}</span>
      </div>
      <div className="flex gap-4 mt-2 text-xs">
        {existingStyle && <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-emerald-500" /> Existing</span>}
        {newStyle && <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-blue-500" /> This file</span>}
      </div>
    </div>
  );
}
