'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function ImportMutualFundsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/import?type=holdings'); }, [router]);
  return null;
}
