type LogActivityFn = (
  eventType: string,
  summary: string,
  mod?: string,
  metadata?: Record<string, unknown>,
) => Promise<void>;

export async function handleErrorsRoute(
  path: string,
  method: string,
  req: Request,
  corsHeaders: Record<string, string>,
  logActivity: LogActivityFn,
): Promise<Response | null> {
  if (path !== '/errors' || method !== 'POST') return null;

  try {
    const body = (await req.json()) as {
      message: string;
      stack?: string;
      component?: string;
      url?: string;
    };
    logActivity('client_error', `[${body.component ?? 'unknown'}] ${body.message}`, undefined, {
      stack: body.stack?.slice(0, 500),
      url: body.url,
    }).catch(() => {});
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
