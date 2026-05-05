'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';
import Card from '@/components/ui/Card';
import { getToken } from '@/lib/auth';

interface UploadResponse {
  success: boolean;
  imported_count: number;
  total_rows: number;
  errors: string[];
  message: string;
  portfolio_id?: number;
}

export default function MutualFundUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadResponse | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');
  const [portfolioName, setPortfolioName] = useState('INDmoney Mutual Fund Import');

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file from INDmoney');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const query = `?portfolio_name=${encodeURIComponent(portfolioName || 'INDmoney Mutual Fund Import')}`;
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(apiUrl(`/api/mutual-funds/import/indmoney${query}`), {
        method: 'POST',
        headers,
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || result.message || 'Mutual fund import failed');
      }

      setSuccess(result as UploadResponse);
      setToastMessage(result.message || 'Funds imported successfully');
      setToastVariant('success');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      setToastMessage(message);
      setToastVariant('error');
      console.error('INDmoney import error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className="p-6 relative">
        {toastMessage && (
          <div
            className={`absolute right-6 top-6 z-20 w-full rounded-2xl border p-4 text-sm shadow-xl sm:w-96 ${
              toastVariant === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950/90 text-rose-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>{toastMessage}</div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <h2 className="text-2xl font-semibold mb-4">Import Mutual Funds</h2>
        <p className="text-slate-400 mb-6">
          Upload INDmoney CSV export to import mutual fund holdings into a portfolio.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="portfolio-name">
            Portfolio name
          </label>
          <input
            id="portfolio-name"
            type="text"
            value={portfolioName}
            onChange={(event) => setPortfolioName(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-slate-600 transition">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="mx-auto px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? 'Uploading...' : 'Select INDmoney CSV'}
          </button>
          <p className="text-slate-400 text-sm mt-4">
            Upload a CSV file exported from INDmoney with mutual fund holdings.
          </p>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
              <p className="text-emerald-300 font-medium">{success.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-slate-400 text-sm">Rows Imported</p>
                <p className="text-2xl font-semibold text-white">{success.imported_count}</p>
              </div>
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-slate-400 text-sm">Total Rows</p>
                <p className="text-2xl font-semibold text-white">{success.total_rows}</p>
              </div>
            </div>
            {success.errors.length > 0 && (
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-slate-200 text-sm font-semibold">Import warnings</p>
                <ul className="mt-2 list-disc list-inside text-slate-400 text-sm">
                  {success.errors.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {success.portfolio_id && (
              <Link
                href={`/portfolio/mutual-funds?portfolio=${success.portfolio_id}`}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                View Imported Portfolio
              </Link>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
