'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';
import Card from '@/components/ui/Card';

interface UploadResponse {
  message: string;
  portfolio_id: number;
  portfolio_name: string;
  total_holdings: number;
  invested_value: number;
  present_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

export default function HoldingsUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadResponse | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setError('Please upload a .xlsx file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(apiUrl('/api/import/upload-holdings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await response.json() as UploadResponse;
      setSuccess(data);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Upload Holdings</h2>
          <p className="text-slate-400 mb-6">
            Upload your Zerodha holdings export (.xlsx file) to analyze your portfolio
          </p>

          <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-slate-600 transition">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Select Excel File'}
            </button>
            <p className="text-slate-400 text-sm mt-4">
              Upload a Zerodha `.xlsx` holdings export
            </p>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-green-400 font-medium">{success.message}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-slate-400 text-sm">Holdings</p>
                  <p className="text-2xl font-semibold text-white">{success.total_holdings}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-slate-400 text-sm">Invested Value</p>
                  <p className="text-2xl font-semibold text-white">₹{success.invested_value.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-slate-400 text-sm">Current Value</p>
                  <p className="text-2xl font-semibold text-white">₹{success.present_value.toLocaleString('en-IN')}</p>
                </div>
                <div className={`p-4 rounded-lg ${success.unrealized_pnl >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                  <p className="text-slate-400 text-sm">Total P&L</p>
                  <p className={`text-2xl font-semibold ${success.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ₹{success.unrealized_pnl.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <Link
                href={`/analytics/${success.portfolio_id}`}
                className="block w-full rounded-full bg-sky-500 px-4 py-3 text-center font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                View Analytics
              </Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
