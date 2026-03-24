#!/usr/bin/env bun
/**
 * Gera TypeScript types a partir do schema do Supabase.
 * Uso: bun db:types
 *
 * Output: packages/db/types/database.ts
 */

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'wmiocwbigobhlapiblwb';
const outputPath = 'packages/db/types/database.ts';

if (!accessToken) {
  process.exit(1);
}

const glob = new Bun.Glob('**/supabase/bin/supabase.exe');
const candidates = await Array.fromAsync(glob.scan({ cwd: 'node_modules/.bun', absolute: true }));
const supabaseBin = candidates[0];

if (!supabaseBin) {
  process.exit(1);
}

const proc = Bun.spawn([supabaseBin, 'gen', 'types', 'typescript', '--project-id', projectRef], {
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
  stdout: 'pipe',
  stderr: 'inherit',
});

const exitCode = await proc.exited;
const output = await new Response(proc.stdout).text();

if (exitCode !== 0 || !output.trim()) {
  process.exit(1);
}

await Bun.write(outputPath, output);
