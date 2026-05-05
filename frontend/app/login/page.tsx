'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import useAuth from '@/hooks/useAuth';

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/portfolio');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900/90 p-8 shadow-xl shadow-slate-900/40">
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="mt-3 text-slate-400">Use this page to sign in to your account.</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-sm text-slate-400">
          New here? <Link href="/signup" className="text-sky-400 hover:text-sky-300">Create an account</Link>.
        </p>
      </div>
    </main>
  );
}
