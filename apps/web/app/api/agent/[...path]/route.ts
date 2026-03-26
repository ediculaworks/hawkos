import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function proxyToAgent(
  request: Request,
  params: Promise<{ path: string[] }>,
): Promise<Response> {
  const cookieStore = await cookies();
  const slug = cookieStore.get('hawk_tenant')?.value;

  if (!slug) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 });
  }

  const tenant = await getTenantPrivateBySlug(slug);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const { path } = await params;
  const agentUrl = `http://localhost:${tenant.agentApiPort}/${path.join('/')}`;

  // Forward query string
  const url = new URL(request.url);
  const targetUrl = url.search ? `${agentUrl}${url.search}` : agentUrl;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  if (tenant.agentApiSecret) {
    headers.set('Authorization', `Bearer ${tenant.agentApiSecret}`);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  const agentResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    signal: AbortSignal.timeout(30000),
  });

  const responseHeaders = new Headers();
  const ct = agentResponse.headers.get('content-type');
  if (ct) responseHeaders.set('Content-Type', ct);

  return new Response(agentResponse.body, {
    status: agentResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToAgent(request, params);
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToAgent(request, params);
}

export async function PUT(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToAgent(request, params);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyToAgent(request, params);
}
