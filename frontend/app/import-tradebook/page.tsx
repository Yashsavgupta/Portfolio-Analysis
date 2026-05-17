'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportTradebookRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/import?type=tradebook');
  }, [router]);
  return null;
}
