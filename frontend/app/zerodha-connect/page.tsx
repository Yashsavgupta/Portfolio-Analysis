'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function ZerodhaConnectRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/import'); }, [router]);
  return null;
}
