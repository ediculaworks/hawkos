import type { SupabaseCompatClient } from '@hawk/db';

type DbClient = SupabaseCompatClient;

export async function handleSettingsRoute(
  path: string,
  method: string,
  req: Request,
  corsHeaders: Record<string, string>,
  requireSupabase: () => DbClient,
): Promise<Response | null> {
  if (path !== '/settings') return null;

  if (method === 'GET') {
    const { data } = await requireSupabase()
      .from('agent_settings')
      .select('*')
      .eq('id', 'singleton')
      .single();
    return new Response(JSON.stringify({ settings: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (method === 'PUT') {
    const body = (await req.json()) as Record<string, unknown>;
    const { data, error } = await requireSupabase()
      .from('agent_settings')
      .upsert({
        id: 'singleton',
        agent_name: body.agent_name as string,
        llm_model: body.llm_model as string,
        temperature: body.temperature as number,
        max_tokens: body.max_tokens as number,
        heartbeat_interval: body.heartbeat_interval as number,
        offline_threshold: body.offline_threshold as number,
        auto_restart: body.auto_restart as boolean,
        enabled_channels: body.enabled_channels as string[],
        enabled_tools: body.enabled_tools as string[] | undefined,
        tenant_name: body.tenant_name as string | undefined,
        timezone: body.timezone as string | undefined,
        language: body.language as string | undefined,
        checkin_morning_enabled: body.checkin_morning_enabled as boolean | undefined,
        checkin_morning_time: body.checkin_morning_time as string | undefined,
        checkin_evening_enabled: body.checkin_evening_enabled as boolean | undefined,
        checkin_evening_time: body.checkin_evening_time as string | undefined,
        weekly_review_enabled: body.weekly_review_enabled as boolean | undefined,
        weekly_review_time: body.weekly_review_time as string | undefined,
        alerts_enabled: body.alerts_enabled as boolean | undefined,
        alerts_time: body.alerts_time as string | undefined,
        security_review_day: body.security_review_day as number | undefined,
        security_review_time: body.security_review_time as string | undefined,
        big_purchase_threshold: body.big_purchase_threshold as number | undefined,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .select()
      .single();
    return new Response(JSON.stringify({ settings: data, error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null;
}
