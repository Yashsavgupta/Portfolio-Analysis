import { useState, useEffect } from 'react';
import { apiUrl } from './api';
import { getAuthHeaders } from './auth';

export function useMFPortfolioId() {
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/mutual-funds/my-portfolio/summary'), {
      headers: getAuthHeaders() as HeadersInit,
    })
      .then((r) => {
        if (r.status === 404) {
          setEmpty(true);
          setLoading(false);
          return null;
        }
        if (!r.ok) throw new Error('Failed to load portfolio');
        return r.json();
      })
      .then((d) => { if (d) setPortfolioId(d.portfolio_id); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { portfolioId, loading, error, empty };
}

export async function fetchMFAnalysis<T>(
  path: string,
  headers: HeadersInit,
): Promise<T> {
  const r = await fetch(apiUrl(path), { headers });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as Record<string, string>).detail ?? 'Request failed');
  }
  return r.json();
}
