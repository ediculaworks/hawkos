import type { SupabaseCompatClient } from '@hawk/db';

export const AUTOMATIONS = [
  {
    name: 'heartbeat',
    description: 'Heartbeat batched (2h, 7am-11pm BRT)',
    cron: '0 7,9,11,13,15,17,19,21,23 * * *',
    category: 'system',
  },
  {
    name: 'daily-checkin-morning',
    description: 'Check-in matinal (09:00)',
    cron: '0 9 * * *',
    category: 'checkin',
  },
  {
    name: 'daily-checkin-evening',
    description: 'Check-in noturno (22:00)',
    cron: '0 22 * * *',
    category: 'checkin',
  },
  {
    name: 'weekly-review',
    description: 'Weekly Review (Domingo 20:00)',
    cron: '0 20 * * 0',
    category: 'review',
  },
  {
    name: 'alerts-daily',
    description: 'Alertas diários (08:00)',
    cron: '0 8 * * *',
    category: 'alerts',
  },
  {
    name: 'alerts-monthly',
    description: 'Security Review (1º dia, 10:00)',
    cron: '0 10 1 * *',
    category: 'alerts',
  },
  {
    name: 'health-insights',
    description: 'Health Insights (09:00)',
    cron: '0 9 * * *',
    category: 'health',
  },
  {
    name: 'content-pipeline',
    description: 'Content Pipeline (Sexta 17:00)',
    cron: '0 17 * * 5',
    category: 'content',
  },
  {
    name: 'session-compactor',
    description: 'Session Compactor (a cada hora)',
    cron: '0 * * * *',
    category: 'system',
  },
];

export async function handleAutomationsRoute(
  path: string,
  method: string,
  req: Request,
  state: { pendingAutomation: string | null },
  corsHeaders: Record<string, string>,
  requireSupabase: () => SupabaseCompatClient,
  triggerAutomation: (name: string) => void,
  logActivity: (
    eventType: string,
    summary: string,
    mod?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>,
): Promise<Response | null> {
  if (!path.startsWith('/automations')) return null;

  if (path === '/automations' && method === 'GET') {
    const db = requireSupabase();
    const { data: configs } = db
      ? await db.from('automation_configs').select('*').order('name')
      : { data: null };
    const merged = AUTOMATIONS.map((a) => {
      // biome-ignore lint/suspicious/noExplicitAny: DB query returns untyped rows
      const config = configs?.find((c: any) => c.id === a.name);
      return {
        ...a,
        custom: false,
        enabled: config?.enabled ?? true,
        cron_expression: config?.cron_expression ?? a.cron,
        last_run: config?.last_run,
        run_count: config?.run_count ?? 0,
      };
    });
    // Include custom automations from DB
    const builtinNames = new Set(AUTOMATIONS.map((a) => a.name));
    const customAutomations = (configs ?? [])
      // biome-ignore lint/suspicious/noExplicitAny: DB query returns untyped rows
      .filter((c: any) => !builtinNames.has(c.id) && c.custom === true)
      // biome-ignore lint/suspicious/noExplicitAny: DB query returns untyped rows
      .map((c: any) => ({
        name: c.id,
        description: c.description ?? c.id,
        cron: c.cron_expression ?? '0 * * * *',
        category: c.category ?? 'custom',
        custom: true,
        enabled: c.enabled ?? true,
        cron_expression: c.cron_expression ?? '0 * * * *',
        last_run: c.last_run,
        run_count: c.run_count ?? 0,
      }));
    return new Response(
      JSON.stringify({
        automations: [...merged, ...customAutomations],
        pending: state.pendingAutomation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (path === '/automations' && method === 'POST') {
    const body = (await req.json()) as Record<string, unknown>;
    const name = body.name as string;
    if (!name) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data, error } = await requireSupabase()
      .from('automation_configs')
      .upsert({
        id: name,
        description: (body.description as string) ?? name,
        cron_expression: (body.cron_expression as string) ?? '0 * * * *',
        category: (body.category as string) ?? 'custom',
        enabled: true,
        custom: true,
        updated_at: new Date().toISOString(),
        // biome-ignore lint/suspicious/noExplicitAny: Supabase types lag behind schema
      } as any)
      .select()
      .single();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await logActivity('automation.created', `Custom automation created: ${name}`, undefined, {
      name,
    });
    return new Response(JSON.stringify({ automation: data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path.startsWith('/automations/') && !path.endsWith('/trigger') && method === 'DELETE') {
    const name = path.split('/')[2] ?? '';
    // Only allow deleting custom automations
    const builtinNames = new Set(AUTOMATIONS.map((a) => a.name));
    if (builtinNames.has(name)) {
      return new Response(JSON.stringify({ error: 'Cannot delete built-in automation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const db2 = requireSupabase();
    if (!db2) {
      return new Response(JSON.stringify({ error: 'Database not available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { error } = await db2.from('automation_configs').delete().eq('id', name);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await logActivity('automation.deleted', `Custom automation deleted: ${name}`, undefined, {
      name,
    });
    return new Response(JSON.stringify({ ok: true, deleted: name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/automations' && method === 'PUT') {
    const body = (await req.json()) as Record<string, unknown>;
    const { data, error } = await requireSupabase()
      .from('automation_configs')
      .upsert({
        id: body.id as string,
        enabled: body.enabled as boolean,
        cron_expression: body.cron_expression as string,
        updated_at: new Date().toISOString(),
        // biome-ignore lint/suspicious/noExplicitAny: Supabase types lag behind schema
      } as any)
      .select()
      .single();
    return new Response(JSON.stringify({ automation: data, error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path.startsWith('/automations/') && path.endsWith('/trigger') && method === 'POST') {
    const name = path.split('/')[2] ?? '';
    triggerAutomation(name);
    const { data } = await requireSupabase()
      .from('automation_configs')
      .select('run_count')
      .eq('id', name)
      .single();
    const newRunCount = (data?.run_count ?? 0) + 1;
    await requireSupabase()
      .from('automation_configs')
      .update({
        last_run: new Date().toISOString(),
        run_count: newRunCount,
        last_status: 'success',
      })
      .eq('id', name);
    return new Response(JSON.stringify({ ok: true, triggered: name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null;
}
