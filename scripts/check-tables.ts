#!/usr/bin/env bun
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  const tables = [
    'agent_status',
    'agent_settings',
    'automation_configs',
    'tool_configs',
    'activity_log',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      // biome-ignore lint/suspicious/noConsole: CLI script needs console output
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI script needs console output
      console.log(`✅ ${table}: existe`);
    }
  }
}

checkTables();
