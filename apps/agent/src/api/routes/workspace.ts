import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function handleWorkspaceRoute(
  path: string,
  method: string,
  req: Request,
  corsHeaders: Record<string, string>,
  workspaceDir: string,
): Promise<Response | null> {
  if (!path.startsWith('/workspace/')) return null;

  if (path === '/workspace/standing-orders' && method === 'GET') {
    try {
      const content = readFileSync(join(workspaceDir, 'STANDING_ORDERS.md'), 'utf-8');
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ content: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  if (path === '/workspace/standing-orders' && method === 'PUT') {
    const body = (await req.json()) as { content: string };
    writeFileSync(join(workspaceDir, 'STANDING_ORDERS.md'), body.content, 'utf-8');
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/workspace/heartbeat' && method === 'GET') {
    try {
      const content = readFileSync(join(workspaceDir, 'HEARTBEAT.md'), 'utf-8');
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ content: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  if (path === '/workspace/heartbeat' && method === 'PUT') {
    const body = (await req.json()) as { content: string };
    writeFileSync(join(workspaceDir, 'HEARTBEAT.md'), body.content, 'utf-8');
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null;
}
