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
    <main className="flex min-h-screen items-center justify-center bg-[#07112c] px-6 py-12 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-500/[0.07] blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="36" height="36" rx="9" fill="url(#login-lm-grad)" />
            <polyline points="5,27 12,18 19,22 31,9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="31" cy="9" r="2.2" fill="white" />
            <defs>
              <linearGradient id="login-lm-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0ea5e9" />
                <stop offset="1" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-slate-400">Sign in to your Portfolio Evaluator account.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <LoginForm />
          <p className="mt-6 text-center text-sm text-slate-400">
            New here?{' '}
            <Link href="/signup" className="font-medium text-sky-400 transition hover:text-sky-300">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
