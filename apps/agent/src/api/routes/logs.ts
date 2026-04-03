import type { SupabaseCompatClient } from '@hawk/db';

type DbClient = SupabaseCompatClient;

export async function handleLogsRoute(
  path: string,
  method: string,
  _req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
  requireSupabase: () => DbClient,
): Promise<Response | null> {
  if (path !== '/logs' || method !== 'GET') return null;

  const limit = Math.min(Number.parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
  const type = url.searchParams.get('type');
  const mod = url.searchParams.get('module');
  const search = url.searchParams.get('search');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = requireSupabase()
    .from('activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq('event_type', type);
  if (mod) query = query.eq('module', mod);
  if (search) query = query.ilike('summary', `%${search}%`);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error, count } = await query;
  return new Response(JSON.stringify({ logs: data ?? [], total: count ?? 0, error }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
