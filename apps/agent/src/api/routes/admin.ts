import { DOCKER_LOG_SERVICES, streamDockerLogs } from '../../docker-logs.js';
import { getTailLines, subscribeToLogs } from '../../log-buffer.js';
import type { TenantContext } from '../../tenant-manager.js';

type StartTenantServicesFn = (ctx: TenantContext) => Promise<void>;

export async function handleAdminRoute(
  path: string,
  method: string,
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
  startTenantServices: StartTenantServicesFn,
): Promise<Response | null> {
  // POST /reload-credentials
  if (path === '/reload-credentials' && method === 'POST') {
    try {
      const { tenantManager } = await import('../../tenant-manager.js');
      await tenantManager.shutdownAll();
      await tenantManager.loadAll();
      for (const ctx of tenantManager.getAll()) {
        await startTenantServices(ctx);
      }
      return new Response(
        JSON.stringify({ success: true, reloaded_at: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // POST /admin/tenants/:slug/start
  const tenantStartMatch = path.match(/^\/admin\/tenants\/([a-z0-9_-]+)\/start$/);
  if (tenantStartMatch && method === 'POST') {
    const slug = tenantStartMatch[1]!;
    try {
      // Apply all tenant migrations before starting services (idempotent via IF NOT EXISTS)
      const { applyMigrationsForSchema } = await import('../../migrations.js');
      await applyMigrationsForSchema(`tenant_${slug}`);

      const { tenantManager } = await import('../../tenant-manager.js');
      const ctx = await tenantManager.addTenant(slug);
      await startTenantServices(ctx);
      return new Response(JSON.stringify({ ok: true, slug, status: ctx.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          slug,
          error: err instanceof Error ? err.message : String(err),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // POST /admin/tenants/:slug/stop
  const tenantStopMatch = path.match(/^\/admin\/tenants\/([a-z0-9_-]+)\/stop$/);
  if (tenantStopMatch && method === 'POST') {
    const slug = tenantStopMatch[1]!;
    try {
      const { tenantManager } = await import('../../tenant-manager.js');
      await tenantManager.removeTenant(slug);
      return new Response(JSON.stringify({ ok: true, slug, stopped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          slug,
          error: err instanceof Error ? err.message : String(err),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // POST /admin/reload
  if (path === '/admin/reload' && method === 'POST') {
    try {
      const { tenantManager } = await import('../../tenant-manager.js');
      await tenantManager.shutdownAll();
      await tenantManager.loadAll();
      for (const ctx of tenantManager.getAll()) {
        await startTenantServices(ctx);
      }
      return new Response(
        JSON.stringify({
          ok: true,
          tenants: tenantManager.getAll().map((t) => ({ slug: t.slug, status: t.status })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // GET /admin/tenants
  if (path === '/admin/tenants' && method === 'GET') {
    const { tenantManager } = await import('../../tenant-manager.js');
    const tenants = tenantManager.getAll().map((t) => {
      // Check if Discord client is connected and ready
      const discordClient = t.discordClient as { isReady?: () => boolean } | undefined;
      const discordOnline = !!discordClient?.isReady?.();
      return {
        slug: t.slug,
        schemaName: t.schemaName,
        status: t.status,
        lastError: t.lastError,
        cronTasks: t.cronTasks.length,
        hasDiscord: !!t.discordClient,
        discordOnline,
      };
    });
    return new Response(JSON.stringify({ tenants, count: tenants.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // GET /admin/logs/stream — SSE log streaming
  if (path === '/admin/logs/stream' && method === 'GET') {
    const tail = Math.min(
      Math.max(Number.parseInt(url.searchParams.get('tail') || '200', 10) || 200, 1),
      1000,
    );
    const service = url.searchParams.get('service') ?? 'agent';

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

        function enqueue(text: string) {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            cleanup();
          }
        }

        function cleanup() {
          if (closed) return;
          closed = true;
          clearInterval(keepalive);
          if (unsubscribe) unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }

        enqueue(`data: ${JSON.stringify({ type: 'connected', service })}\n\n`);

        let unsubscribe: (() => void) | null = null;

        if (service === 'agent') {
          for (const line of getTailLines(tail)) {
            enqueue(
              `data: ${JSON.stringify({ type: 'log', level: line.level, ts: line.ts, line: line.text })}\n\n`,
            );
          }
          unsubscribe = subscribeToLogs((line) => {
            enqueue(
              `data: ${JSON.stringify({ type: 'log', level: line.level, ts: line.ts, line: line.text })}\n\n`,
            );
          });
        } else if (DOCKER_LOG_SERVICES.includes(service)) {
          streamDockerLogs(
            service,
            tail,
            (text) => {
              const level = /error/i.test(text) ? 'error' : /warn/i.test(text) ? 'warn' : 'log';
              enqueue(
                `data: ${JSON.stringify({ type: 'log', level, ts: new Date().toISOString(), line: text })}\n\n`,
              );
            },
            req.signal,
          );
        } else {
          enqueue(
            `data: ${JSON.stringify({ type: 'error', message: `Unknown service: ${service}` })}\n\n`,
          );
          cleanup();
          return;
        }

        const keepalive = setInterval(() => {
          enqueue(': keepalive\n\n');
        }, 15_000);
        req.signal.addEventListener('abort', cleanup, { once: true });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  return null;
}
