#!/usr/bin/env bun
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const schema = process.argv[2] || process.env.TENANT_SCHEMA || 'public';

async function checkTables() {
  const tables = [
    'agent_status',
    'agent_settings',
    'automation_configs',
    'tool_configs',
    'activity_log',
  ];

  console.log(`Checking tables in schema: ${schema}\n`);

  for (const table of tables) {
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
        await tx.unsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
      });
      console.log(`✅ ${table}: exists`);
    } catch {
      console.log(`❌ ${table}: not found`);
    }
  }
}

checkTables().finally(() => sql.end());
