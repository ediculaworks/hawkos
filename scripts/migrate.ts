#!/usr/bin/env bun
/**
 * Aplica migrations no Supabase remoto.
 * Uso: bun db:migrate
 *
 * Lê SUPABASE_ACCESS_TOKEN e SUPABASE_DB_PASSWORD do .env automaticamente.
 */

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!accessToken) {
  process.exit(1);
}
if (!dbPassword) {
  process.exit(1);
}

// Localiza o binário da Supabase CLI instalado via bun
const glob = new Bun.Glob('**/supabase/bin/supabase.exe');
const candidates = await Array.fromAsync(glob.scan({ cwd: 'node_modules/.bun', absolute: true }));
const supabaseBin = candidates[0];

if (!supabaseBin) {
  process.exit(1);
}

const proc = Bun.spawn([supabaseBin, 'db', 'push', '--password', dbPassword, '--yes'], {
  cwd: 'packages/db',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});

const exitCode = await proc.exited;

if (exitCode === 0) {
} else {
  process.exit(exitCode);
}
