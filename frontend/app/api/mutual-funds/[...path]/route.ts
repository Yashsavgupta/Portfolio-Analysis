import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

function buildBackendUrl(pathSegments: string[] | string | undefined, search: string) {
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';
  return `${backendUrl}/api/mutual-funds/${path}${search}`;
}

function buildHeaders(request: NextRequest) {
  const headers = new Headers();
  const authHeader = request.headers.get('authorization');
  const cookieToken = request.cookies.get('token')?.value;
  const contentType = request.headers.get('content-type');

  if (authHeader) {
    headers.set('authorization', authHeader);
  } else if (cookieToken) {
    headers.set('authorization', `Bearer ${cookieToken}`);
  }

  if (contentType) headers.set('content-type', contentType);
  return headers;
}

async function proxyRequest(request: NextRequest, pathSegments: string[] | string | undefined) {
  const url = buildBackendUrl(pathSegments, request.nextUrl.search);
  const body =
    request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined;

  const response = await fetch(url, {
    method: request.method,
    headers: buildHeaders(request),
    body,
  });

  const responseBody = await response.arrayBuffer();
  const proxyResponse = new NextResponse(responseBody, { status: response.status });
  response.headers.forEach((value, key) => {
    proxyResponse.headers.set(key, value);
  });
  return proxyResponse;
}

export async function GET(request: NextRequest, { params }: { params: { path?: string | string[] } }) {
  return proxyRequest(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path?: string | string[] } }) {
  return proxyRequest(request, params.path);
}
