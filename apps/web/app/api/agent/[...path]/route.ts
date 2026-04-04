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
  // In multi-tenant single-process mode: always route to "agent" service on port 3001
  // In Docker: use service name. Locally: use localhost:port.
  const isDocker = process.env.DOCKER === '1' || process.env.HOSTNAME;
  const agentHost = isDocker ? 'agent' : 'localhost';
  const agentPort = isDocker ? 3001 : tenant.agentApiPort || 3001;
  const agentUrl = `http://${agentHost}:${agentPort}/${path.join('/')}`;

  // Forward query string
  const url = new URL(request.url);
  const targetUrl = url.search ? `${agentUrl}${url.search}` : agentUrl;

  // Detect SSE requests (admin/logs/stream, stream endpoint)
  const isSSE = path.join('/') === 'admin/logs/stream' || path.join('/') === 'stream';

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
    // SSE connections need a much longer timeout (10 minutes); normal requests 30s
    signal: AbortSignal.timeout(isSSE ? 600_000 : 30_000),
  });

  const responseHeaders = new Headers();
  const ct = agentResponse.headers.get('content-type');
  if (ct) responseHeaders.set('Content-Type', ct);

  // For SSE responses: pass through streaming headers to prevent buffering
  if (isSSE || ct?.includes('text/event-stream')) {
    responseHeaders.set('Cache-Control', 'no-cache');
    responseHeaders.set('Connection', 'keep-alive');
    responseHeaders.set('X-Accel-Buffering', 'no');
  }

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
