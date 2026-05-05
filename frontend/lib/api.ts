import { getAuthHeaders } from './auth';

export async function fetcher(url: string, options?: RequestInit) {
  const headers = {
    ...getAuthHeaders(),
    ...(options?.headers || {}),
  } as HeadersInit;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export function apiUrl(path: string) {
  // Keep app API calls same-origin so Next route handlers can proxy auth and uploads consistently.
  if (path.startsWith('/api/')) {
    return path;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  return `${baseUrl}${path}`;
}

export async function apiCall(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: unknown
) {
  const options: RequestInit = {
    method,
    headers: getAuthHeaders() as HeadersInit,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  return fetcher(apiUrl(path), options);
}
