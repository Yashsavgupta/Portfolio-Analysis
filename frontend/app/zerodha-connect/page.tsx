'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface ZerodhaStatus {
  connected: boolean;
  message: string;
  user_id?: string;
}

function ZerodhaConnectContent() {
  const [status, setStatus] = useState<ZerodhaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestToken = searchParams.get('request_token');

  // Check connection status on mount
  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (requestToken) {
      completeConnection(requestToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestToken]);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/zerodha/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        // If not authenticated, redirect to login
        router.push('/login');
        return;
      }
    } catch (error) {
      console.error('Error checking Zerodha status:', error);
    } finally {
      setLoading(false);
    }
  };

  const initiateConnection = async () => {
    setConnecting(true);
    try {
      const response = await fetch('/api/zerodha/connect', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Zerodha login
        window.location.href = data.redirect_url;
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to initiate connection'}`);
      }
    } catch (error) {
      console.error('Error initiating Zerodha connection:', error);
      alert('Failed to connect to Zerodha. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const completeConnection = async (token: string) => {
    setConnecting(true);
    try {
      const response = await fetch('/api/zerodha/connect/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request_token: token }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Zerodha account connected successfully!');
        // Remove the request_token from URL
        router.replace('/zerodha-connect');
        // Refresh status
        await checkStatus();
      } else {
        alert(`Connection failed: ${data.detail || data.message || 'Unable to complete the connection'}`);
      }
    } catch (error) {
      console.error('Error completing Zerodha connection:', error);
      alert('Failed to complete connection. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/30">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Zerodha Connect</h1>
          <p className="mt-3 text-slate-400">
            Connect your Zerodha account to import your portfolio data and track your investments.
          </p>
        </div>

        <div className="space-y-6">
          {/* Connection Status */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
            {status ? (
              <div className={`p-4 rounded-lg ${status.connected ? 'bg-green-900/20 border border-green-700' : 'bg-yellow-900/20 border border-yellow-700'}`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <div>
                    <p className="font-medium">{status.connected ? 'Connected' : 'Not Connected'}</p>
                    <p className="text-sm text-slate-400">{status.message}</p>
                    {status.user_id && (
                      <p className="text-sm text-slate-500">User ID: {status.user_id}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Unable to check connection status.</p>
            )}
          </Card>

          {/* Connection Actions */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Connect Account</h2>
            <p className="text-slate-400 mb-6">
              Click the button below to securely connect your Zerodha account. You will be redirected to the Zerodha login page.
            </p>

            {status?.connected ? (
              <div className="space-y-4">
                <p className="text-green-400 font-medium">✓ Your Zerodha account is connected!</p>
                <div className="flex space-x-4">
                  <Link href="/portfolio">
                    <Button>View Portfolio</Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/zerodha-connect')}
                  >
                    Refresh Status
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={initiateConnection}
                disabled={connecting}
                className="w-full sm:w-auto"
              >
                {connecting ? 'Connecting...' : 'Connect Zerodha Account'}
              </Button>
            )}
          </Card>

          {/* Features */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">What You Get</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium">Real-time Holdings</h3>
                  <p className="text-sm text-slate-400">Import your current stock and mutual fund holdings</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium">Order History</h3>
                  <p className="text-sm text-slate-400">Track your trading history and performance</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium">Portfolio Analytics</h3>
                  <p className="text-sm text-slate-400">Get insights into your investment performance</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium">Secure Connection</h3>
                  <p className="text-sm text-slate-400">Your data is encrypted and securely stored</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ZerodhaConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
          <div className="mx-auto max-w-4xl">
            <LoadingSkeleton />
          </div>
        </div>
      }
    >
      <ZerodhaConnectContent />
    </Suspense>
  );
}
