import { verifyToken } from '@hawk/auth';
import { getPool } from '@hawk/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

interface SetupRequestBody {
  name: string;
  birthDate?: string;
  timezone?: string;
  bio?: string;
  goals?: string;
  avatarUrl?: string;
  checkinMorning?: string;
  checkinEvening?: string;
  weeklyReviewDay?: string;
  weeklyReviewTime?: string;
  enabledModules?: string[];
  enabledAgents?: string[];
}

const VALID_MODULES = [
  'finances',
  'health',
  'people',
  'career',
  'objectives',
  'routine',
  'assets',
  'entertainment',
  'legal',
  'housing',
  'calendar',
];

const VALID_AGENTS = ['bull', 'wolf', 'owl', 'bee', 'beaver', 'fox', 'peacock'];

const VALID_WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const TIME_RE = /^\d{2}:\d{2}$/;

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const cookieStore = await cookies();
    const token = cookieStore.get('hawk_session')?.value;
    const tenantSlug = cookieStore.get('hawk_tenant')?.value;

    if (!token || !tenantSlug) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const schemaName = `tenant_${tenantSlug}`;

    // ── Validate body ────────────────────────────────────────
    const body: SetupRequestBody = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Nome e obrigatorio' }, { status: 400 });
    }

    const name = body.name.trim().slice(0, 200);
    const birthDate = body.birthDate || null;
    const timezone = body.timezone || 'America/Sao_Paulo';
    const bio = body.bio?.trim().slice(0, 300) || null;
    const goals = body.goals?.trim().slice(0, 500) || null;
    const avatarUrl = body.avatarUrl || null;

    const checkinMorning = body.checkinMorning && TIME_RE.test(body.checkinMorning)
      ? body.checkinMorning
      : '09:00';
    const checkinEvening = body.checkinEvening && TIME_RE.test(body.checkinEvening)
      ? body.checkinEvening
      : '22:00';
    const weeklyReviewDay = body.weeklyReviewDay && VALID_WEEKDAYS.includes(body.weeklyReviewDay)
      ? body.weeklyReviewDay
      : 'sunday';
    const weeklyReviewTime = body.weeklyReviewTime && TIME_RE.test(body.weeklyReviewTime)
      ? body.weeklyReviewTime
      : '20:00';

    const enabledModules = Array.isArray(body.enabledModules)
      ? body.enabledModules.filter((m) => VALID_MODULES.includes(m))
      : VALID_MODULES;

    const enabledAgents = Array.isArray(body.enabledAgents)
      ? body.enabledAgents.filter((a) => VALID_AGENTS.includes(a))
      : VALID_AGENTS;

    // ── Build metadata JSONB ─────────────────────────────────
    const metadata = {
      timezone,
      bio,
      goals_summary: goals,
      avatar_url: avatarUrl,
      checkin_morning: checkinMorning,
      checkin_evening: checkinEvening,
      weekly_review_day: weeklyReviewDay,
      weekly_review_time: weeklyReviewTime,
      enabled_agents: enabledAgents,
    };

    // ── Execute in transaction ───────────────────────────────
    const sql = getPool();

    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);

      // 1. Upsert profile — handles both first-time setup and re-onboarding after data reset
      await tx.unsafe(
        `INSERT INTO profile (id, name, birth_date, metadata, onboarding_complete, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, true, now(), now())
         ON CONFLICT (id) DO UPDATE SET
           name = $2,
           birth_date = $3,
           metadata = COALESCE(profile.metadata, '{}'::jsonb) || $4::jsonb,
           onboarding_complete = true,
           updated_at = now()`,
        [payload.sub, name, birthDate, JSON.stringify(metadata)],
      );

      // 2. Update modules — enable selected, disable rest
      for (const modId of VALID_MODULES) {
        const enabled = enabledModules.includes(modId);
        await tx.unsafe(
          'UPDATE modules SET enabled = $1 WHERE id = $2',
          [enabled, modId],
        );
      }

      // 3. Upsert agent_settings with timezone + schedule columns
      const weekdayIndex = VALID_WEEKDAYS.indexOf(weeklyReviewDay);

      await tx.unsafe(
        `INSERT INTO agent_settings (
           id, timezone, checkin_morning_time, checkin_evening_time,
           weekly_review_time, security_review_day
         ) VALUES ('singleton', $1, $2::time, $3::time, $4::time, $5)
         ON CONFLICT (id) DO UPDATE SET
           timezone = $1,
           checkin_morning_time = $2::time,
           checkin_evening_time = $3::time,
           weekly_review_time = $4::time,
           security_review_day = $5,
           updated_at = now()`,
        [timezone, checkinMorning, checkinEvening, weeklyReviewTime, weekdayIndex],
      );

      // 4. Register owner_email in admin.tenants so login auto-resolves to this workspace
      await tx.unsafe(
        `UPDATE admin.tenants SET owner_email = $1, updated_at = now() WHERE slug = $2`,
        [payload.email, tenantSlug],
      );
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/setup/complete] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
