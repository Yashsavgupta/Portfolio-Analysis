'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface ApiKeys {
  api_key?: string;
  has_api_secret?: boolean;
}

export default function ZerodhaApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const response = await fetch('/api/zerodha/api-keys');
        if (response.ok) {
          const data = (await response.json()) as ApiKeys;
          setApiKeys(data);
          return;
        }

        if (response.status === 401) {
          router.push('/login');
          return;
        }

        const error = await response.json().catch(() => ({}));
        setMessage(error.detail || 'Failed to load Zerodha API settings');
      } catch (error) {
        setMessage('Failed to load Zerodha API settings');
      } finally {
        setLoading(false);
      }
    };

    loadApiKeys();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const apiKey = String(formData.get('api_key') || '').trim();
    const apiSecret = String(formData.get('api_secret') || '').trim();

    try {
      const response = await fetch('/api/zerodha/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.detail || 'Failed to save API keys');
        return;
      }

      setApiKeys({
        api_key: apiKey,
        has_api_secret: true,
      });
      setMessage('Zerodha API keys saved successfully');
      event.currentTarget.reset();
    } catch (error) {
      setMessage('An error occurred while saving API keys');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-2xl">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  const isSuccess = Boolean(message && message.toLowerCase().includes('success'));

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Zerodha API Keys</h1>
          <p className="mt-3 text-slate-400">
            Save your Zerodha developer credentials once, then complete the account connection flow.
          </p>
        </div>

        <Card className="p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="api_key" className="block text-sm font-medium text-slate-200">
                API Key
              </label>
              <input
                id="api_key"
                name="api_key"
                type="text"
                required
                defaultValue={apiKeys.api_key || ''}
                className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500"
                placeholder="Enter your Zerodha API key"
              />
            </div>

            <div>
              <label htmlFor="api_secret" className="block text-sm font-medium text-slate-200">
                API Secret
              </label>
              <input
                id="api_secret"
                name="api_secret"
                type="password"
                className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500"
                placeholder={apiKeys.has_api_secret ? 'Leave blank to keep the saved secret' : 'Enter your Zerodha API secret'}
              />
              <p className="mt-2 text-sm text-slate-400">
                {apiKeys.has_api_secret
                  ? 'A secret is already saved for this account. Enter a new one only if you want to replace it.'
                  : 'The secret is required the first time you save credentials.'}
              </p>
            </div>

            {message ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  isSuccess
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={saving} className="sm:min-w-40">
                {saving ? 'Saving...' : 'Save Credentials'}
              </Button>
              <Link
                href="/zerodha-connect"
                className="inline-flex items-center justify-center rounded-full border border-slate-600 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
              >
                Continue to Connect
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
