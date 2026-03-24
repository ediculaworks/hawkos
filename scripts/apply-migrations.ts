#!/usr/bin/env bun
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // biome-ignore lint/suspicious/noConsole: CLI script needs console output
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyNewMigrations() {
  // Check if agent_status exists
  const { error: statusError } = await supabase.from('agent_status').select('id').limit(1);

  if (!statusError) {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('✅ agent_status already exists');
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('Creating agent_status table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_status (
          id TEXT PRIMARY KEY DEFAULT 'singleton',
          status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'restarting')),
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
          version TEXT,
          environment TEXT,
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        INSERT INTO agent_status (id, status, environment, version) VALUES ('singleton', 'online', 'development', '0.1.0') ON CONFLICT (id) DO NOTHING;
      `,
    });
  }

  // Check if agent_settings exists
  const { error: settingsError } = await supabase.from('agent_settings').select('id').limit(1);

  if (!settingsError) {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('✅ agent_settings already exists');
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('Creating agent_settings table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_settings (
          id TEXT PRIMARY KEY DEFAULT 'singleton',
          agent_name TEXT NOT NULL DEFAULT 'Hawk',
          system_prompt_path TEXT NOT NULL DEFAULT 'apps/agent/groups/main/CLAUDE.md',
          llm_model TEXT NOT NULL DEFAULT 'openrouter/auto',
          temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7,
          max_tokens INTEGER NOT NULL DEFAULT 2048,
          heartbeat_interval INTEGER NOT NULL DEFAULT 30,
          offline_threshold INTEGER NOT NULL DEFAULT 60,
          auto_restart BOOLEAN NOT NULL DEFAULT true,
          enabled_channels TEXT[] NOT NULL DEFAULT ARRAY['discord', 'web'],
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        INSERT INTO agent_settings (id, agent_name) VALUES ('singleton', 'Hawk') ON CONFLICT (id) DO NOTHING;
      `,
    });
  }

  // Check if automation_configs exists
  const { error: autoError } = await supabase.from('automation_configs').select('id').limit(1);

  if (!autoError) {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('✅ automation_configs already exists');
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('Creating automation_configs table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS automation_configs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          enabled BOOLEAN NOT NULL DEFAULT true,
          cron_expression TEXT NOT NULL,
          last_run TIMESTAMPTZ,
          last_status TEXT CHECK (last_status IN ('success', 'failure', NULL)),
          run_count INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `,
    });
  }

  // Check if tool_configs exists
  const { error: toolError } = await supabase.from('tool_configs').select('tool_name').limit(1);

  if (!toolError) {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('✅ tool_configs already exists');
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI script needs console output
    console.log('Creating tool_configs table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS tool_configs (
          tool_name TEXT PRIMARY KEY,
          module_name TEXT NOT NULL,
          description TEXT,
          enabled BOOLEAN NOT NULL DEFAULT true,
          parameters JSONB DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `,
    });
  }

  // biome-ignore lint/suspicious/noConsole: CLI script needs console output
  console.log('✅ Migration check complete');
}

applyNewMigrations().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI script needs console output
  console.error(err);
});
