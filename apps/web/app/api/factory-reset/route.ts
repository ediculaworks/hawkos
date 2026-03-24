'use server';

import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

const TABLES_TO_WIPE = [
  // Memory & Conversations (order matters for FK)
  'session_memories',
  'agent_conversations',
  'conversation_summaries',
  'conversation_messages',
  'session_archives',
  'agent_messages',
  'agent_memories',
  'activity_log',

  // Health
  'medication_logs',
  'medications',
  'conditions',
  'substance_logs',
  'lab_results',
  'body_measurements',
  'nutrition_logs',
  'workout_sets',
  'workout_sessions',
  'sleep_sessions',
  'health_observations',

  // Finances
  'finance_transactions',
  'finance_recurring',
  'finance_accounts',
  'finance_categories',

  // Calendar
  'calendar_reminders',
  'calendar_attendees',
  'calendar_events',
  'calendar_sync_config',

  // Routine & Journal
  'habit_logs',
  'habits',
  'journal_entries',

  // Objectives
  'tasks',
  'objectives',

  // People & Career
  'interactions',
  'people',
  'work_logs',
  'projects',
  'workspaces',

  // Legal
  'legal_obligations',
  'contracts',
  'legal_entities',

  // Knowledge
  'knowledge_notes',
  'books',

  // Assets & Housing
  'documents',
  'assets',
  'maintenance_logs',
  'housing_bills',
  'residences',

  // Security
  'security_items',

  // Entertainment & Social
  'media_items',
  'hobby_logs',
  'social_posts',
  'social_goals',

  // Spirituality
  'reflections',
  'personal_values',

  // Tags
  'entity_tags',
  'tags',

  // Onboarding
  'data_gaps',
  'onboarding_questions',

  // Modules (will be re-seeded)
  'modules',
];

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Missing Supabase service role configuration' },
      { status: 500 },
    );
  }

  const body = await request.json();
  if (body?.confirmation !== 'APAGAR TUDO') {
    return NextResponse.json({ error: 'Invalid confirmation phrase' }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey);

  const errors: string[] = [];
  let wiped = 0;

  for (const table of TABLES_TO_WIPE) {
    const { error } = await supabase.from(table).delete().gte('created_at', '1970-01-01');
    if (error) {
      // Table may not exist yet (migration not applied) — skip silently
      if (!error.message.includes('does not exist')) {
        errors.push(`${table}: ${error.message}`);
      }
    } else {
      wiped++;
    }
  }

  // Reset profile to defaults (keep the row)
  await supabase
    .from('profile')
    .update({
      name: 'User',
      birth_date: '2000-01-01',
      metadata: {},
      onboarding_complete: false,
      cpf: null,
    })
    .not('name', 'is', null);

  // Clear integration configs
  await supabase
    .from('integration_configs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  // Reset agent_settings to defaults
  await supabase.from('agent_settings').upsert(
    {
      id: 'singleton',
      agent_name: 'Hawk',
      tenant_name: 'My Agent',
      llm_model: 'openrouter/auto',
      temperature: 0.7,
      max_tokens: 2048,
      heartbeat_interval: 30,
      offline_threshold: 60,
      auto_restart: true,
      enabled_channels: ['discord', 'web'],
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      checkin_morning_enabled: true,
      checkin_morning_time: '09:00',
      checkin_evening_enabled: true,
      checkin_evening_time: '22:00',
      weekly_review_enabled: true,
      weekly_review_time: '20:00',
      alerts_enabled: true,
      alerts_time: '08:00',
      security_review_day: 1,
      security_review_time: '10:00',
      big_purchase_threshold: 500,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  // Re-seed modules as disabled
  const moduleIds = [
    'finances',
    'health',
    'people',
    'career',
    'objectives',
    'knowledge',
    'routine',
    'assets',
    'entertainment',
    'legal',
    'social',
    'spirituality',
    'housing',
    'security',
    'calendar',
    'journal',
  ];

  for (const id of moduleIds) {
    await supabase.from('modules').upsert({ id, enabled: false }, { onConflict: 'id' });
  }

  return NextResponse.json({
    success: errors.length === 0,
    wiped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
