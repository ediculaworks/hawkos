#!/usr/bin/env bun
/**
 * Aplica migrations em um Supabase especificado via args.
 * Uso: bun scripts/migrate-to.ts --project hawkos
 *       bun scripts/migrate-to.ts --project hawkos --migration 20260410000000_admin_schema
 */

import { parseArgs } from 'util';

const args = parseArgs({
  options: {
    project: { type: 'string', default: 'hawkos' },
    migration: { type: 'string' },
    dryRun: { type: 'boolean', default: false },
  },
  strict: false,
});

const PROJECT = args.values.project;
const MIGRATION = args.values.migration;

const projects: Record<string, { projectId: string; accessToken: string; dbPassword: string }> = {
  hawkos: {
    projectId: 'mglzbxtiyzgqeszscppy',
    accessToken: 'sbp_78760318914346e8416b79a72766ede22d194282',
    dbPassword: 'S3uOJUYJ5rR8yPG5',
  },
  local: {
    projectId: 'db',
    accessToken: process.env.SUPABASE_ACCESS_TOKEN || '',
    dbPassword: '',
  },
};

const config = projects[PROJECT];
if (!config) {
  console.error(`Projeto desconhecido: ${PROJECT}`);
  process.exit(1);
}

console.log(`\n🚀 Aplicando migration em ${PROJECT}...`);
console.log(`   Project ID: ${config.projectId}`);
console.log(`   DB Password: ${config.dbPassword ? '***' : '(vazio)'}`);

// Localiza o binário da Supabase CLI
const glob = new Bun.Glob('**/supabase/bin/supabase.exe');
const candidates = await Array.fromAsync(glob.scan({ cwd: 'node_modules/.bun', absolute: true }));
const supabaseBin = candidates[0];

if (!supabaseBin) {
  console.error('❌ Supabase CLI não encontrado');
  process.exit(1);
}

console.log(`\n📦 Usando Supabase CLI: ${supabaseBin}`);

const migrationsDir = 'packages/db/supabase/migrations';

if (MIGRATION) {
  const migrationFile = `${migrationsDir}/${MIGRATION}.sql`;
  console.log(`\n📄 Aplicando migration específica: ${MIGRATION}.sql`);
  
  const env = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: config.accessToken,
  };
  
  const proc = Bun.spawn([
    supabaseBin,
    'db',
    'push',
    '--project-ref',
    config.projectId,
    '--password',
    config.dbPassword,
    '--yes',
    '--dry-run',
    args.values.dryRun ? 'true' : 'false',
  ], {
    cwd: process.cwd(),
    env,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });
  
  const exitCode = await proc.exited;
  process.exit(exitCode);
}

// Lista todas as migrations disponíveis
const files = await Bun.file(migrationsDir).ls();
console.log('\n📁 Migrações disponíveis:');
for (const file of files) {
  if (file.name?.endsWith('.sql')) {
    console.log(`   - ${file.name}`);
  }
}

console.log('\n✅ Para aplicar uma migration específica:');
console.log(`   bun scripts/migrate-to.ts --project ${PROJECT} --migration NOME_DA_MIGRATION`);
console.log('\n⚠️ Por enquanto, migrations são aplicadas manualmente via Supabase Dashboard ou CLI local.');