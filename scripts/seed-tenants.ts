#!/usr/bin/env bun
/**
 * Seed script for Hawk OS multi-tenant system.
 *
 * Creates 6 tenants in admin.tenants, creates a PostgreSQL schema per tenant,
 * applies all migrations, and seeds auth_users + profile + modules.
 *
 * Usage: bun --env-file=.env scripts/seed-tenants.ts
 */

import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashSync } from '@node-rs/bcrypt';
import postgres from 'postgres';

// ── Constants ────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const LEGACY_SALT = 'hawk-os-admin-salt-v1';
const BCRYPT_ROUNDS = 12;

const MODULES = [
  'finances', 'health', 'people', 'career', 'objectives', 'routine',
  'assets', 'entertainment', 'legal', 'housing', 'calendar', 'security',
  'social', 'spirituality', 'journal', 'knowledge',
];

const USERS = [
  { slug: 'ten1', label: 'Lucas Drummond', email: 'lucas.drummondpv@gmail.com', password: 'senha123', role: 'admin' },
  { slug: 'ten2', label: 'Luca Junqueira', email: 'lucajunqueira98@gmail.com', password: 'senha123', role: 'user' },
  { slug: 'ten3', label: 'João Pedro Santana', email: 'joaopedro@hawkos.online', password: 'senha123', role: 'user' },
  { slug: 'ten4', label: 'Gabriel Fonseca', email: 'gabrielfonseca@hawkos.online', password: 'senha123', role: 'user' },
  { slug: 'ten5', label: 'Guilherme Sad', email: 'guilhermesad@hawkos.online', password: 'senha123', role: 'user' },
  { slug: 'ten6', label: 'Matheus Guim', email: 'matheusguim@hawkos.online', password: 'senha123', role: 'user' },
];

// ── Encryption (mirrors packages/admin/src/crypto.ts) ────────────────────────

function deriveKey(masterKey: string, salt?: string | null): Buffer {
  return createHash('sha256')
    .update(masterKey + (salt || LEGACY_SALT))
    .digest();
}

function encrypt(
  text: string,
  masterKey: string,
  salt?: string | null,
): { encrypted: string; iv: string } {
  const key = deriveKey(masterKey, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), tag]);
  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

function generateAgentSecret(): string {
  return randomBytes(32).toString('hex');
}

// ── Migration loader ─────────────────────────────────────────────────────────

function loadMigrations(): Array<{ name: string; sql: string }> {
  const migrationsDir = join(import.meta.dir, '../packages/db/supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== 'pending_admin_schema.sql')
    .sort();

  return files.map((name) => ({
    name,
    sql: readFileSync(join(migrationsDir, name), 'utf-8'),
  }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const masterKey = process.env.ADMIN_MASTER_KEY || process.env.ENCRYPTION_KEY;

  if (!databaseUrl) {
    console.error('[seed-tenants] DATABASE_URL is required');
    process.exit(1);
  }
  if (!masterKey) {
    console.error('[seed-tenants] ADMIN_MASTER_KEY or ENCRYPTION_KEY is required for encryption');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 5 });

  console.log('[seed-tenants] Connected to database');
  console.log('[seed-tenants] Loading migrations...');
  const migrations = loadMigrations();
  console.log(`[seed-tenants] Found ${migrations.length} migration files`);

  for (const user of USERS) {
    const schemaName = `tenant_${user.slug}`;
    const num = user.slug.replace('ten', '');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[seed-tenants] Processing ${user.slug}: ${user.label} (${schemaName})`);
    console.log('='.repeat(60));

    // ── 1. Check if tenant already exists in admin.tenants ───────────────
    const existing = await sql`
      SELECT id, slug FROM admin.tenants WHERE slug = ${user.slug}
    `;

    let tenantId: string;

    if (existing.length > 0) {
      tenantId = existing[0].id;
      console.log(`[${user.slug}] Tenant already exists (id: ${tenantId}), skipping insert`);
    } else {
      // ── 2. Build encrypted configs ───────────────────────────────────────
      const keySalt = randomBytes(16).toString('hex');

      // Discord config
      const discordBotToken = process.env[`TEN${num}_DISCORD_BOT_TOKEN`] || '';
      const discordClientId = process.env[`TEN${num}_DISCORD_CLIENT_ID`] || '';
      const discordGuildId = process.env[`TEN${num}_DISCORD_GUILD_ID`] || '';
      const discordChannelId = process.env[`TEN${num}_DISCORD_CHANNEL_ID`] || '';
      const discordUserId = process.env[`TEN${num}_DISCORD_USER_ID`] || '';

      const discordConfig = JSON.stringify({
        bot_token: discordBotToken,
        client_id: discordClientId,
        guild_id: discordGuildId,
        channel_id: discordChannelId,
        authorized_user_id: discordUserId,
      });

      let discordEncrypted: string | null = null;
      let discordIv: string | null = null;
      if (discordBotToken) {
        const enc = encrypt(discordConfig, masterKey, keySalt);
        discordEncrypted = enc.encrypted;
        discordIv = enc.iv;
        console.log(`[${user.slug}] Discord config encrypted`);
      } else {
        console.log(`[${user.slug}] No Discord env vars found (TEN${num}_DISCORD_BOT_TOKEN), skipping encryption`);
      }

      // OpenRouter config
      const openrouterApiKey = process.env[`TEN${num}_OPENROUTER_API_KEY`] || '';

      const openrouterConfig = JSON.stringify({
        api_key: openrouterApiKey,
        model: 'openrouter/auto',
        max_tokens: 4096,
      });

      let openrouterEncrypted: string | null = null;
      let openrouterIv: string | null = null;
      if (openrouterApiKey) {
        const enc = encrypt(openrouterConfig, masterKey, keySalt);
        openrouterEncrypted = enc.encrypted;
        openrouterIv = enc.iv;
        console.log(`[${user.slug}] OpenRouter config encrypted`);
      } else {
        console.log(`[${user.slug}] No OpenRouter env var found (TEN${num}_OPENROUTER_API_KEY), skipping encryption`);
      }

      // ── 3. Insert into admin.tenants ─────────────────────────────────────
      const agentSecret = generateAgentSecret();
      const result = await sql`
        INSERT INTO admin.tenants (
          slug, label, schema_name, status, agent_port, agent_secret,
          discord_config_encrypted, discord_config_iv,
          openrouter_config_encrypted, openrouter_config_iv,
          key_salt, feature_flags
        ) VALUES (
          ${user.slug}, ${user.label}, ${schemaName}, 'active', ${null},
          ${agentSecret},
          ${discordEncrypted}, ${discordIv},
          ${openrouterEncrypted}, ${openrouterIv},
          ${keySalt}, ${sql.json({})}
        )
        RETURNING id
      `;
      tenantId = result[0].id;
      console.log(`[${user.slug}] Tenant created in admin.tenants (id: ${tenantId})`);

      // ── 4. Insert tenant modules into admin.tenant_modules ─────────────
      for (const moduleId of MODULES) {
        await sql`
          INSERT INTO admin.tenant_modules (tenant_id, module_id, enabled, config)
          VALUES (${tenantId}, ${moduleId}, false, ${sql.json({})})
          ON CONFLICT (tenant_id, module_id) DO NOTHING
        `;
      }
      console.log(`[${user.slug}] ${MODULES.length} modules seeded in admin.tenant_modules`);
    }

    // ── 5. Create schema + run migrations (new tenants only) ────────────
    // Skip for existing tenants: seed migrations have bare INSERTs that would
    // create duplicate rows (habits, categories, accounts, etc.) on every run.
    const isNewTenant = existing.length === 0;

    if (isNewTenant) {
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      console.log(`[${user.slug}] Schema "${schemaName}" ensured`);

      // Grant privileges so authenticated role can use this schema
      await sql.unsafe(`GRANT USAGE ON SCHEMA "${schemaName}" TO authenticated`);
      await sql.unsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON TABLES TO authenticated`,
      );
      await sql.unsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON SEQUENCES TO authenticated`,
      );

      // ── 6. Apply all migrations in the tenant schema ─────────────────────
      console.log(`[${user.slug}] Applying ${migrations.length} migrations...`);
      let applied = 0;
      let skipped = 0;

      for (const migration of migrations) {
        try {
          await sql.begin(async (tx) => {
            await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
            await tx.unsafe(migration.sql);
          });
          applied++;
        } catch (err) {
          // Expected: some migrations reference admin schema tables or create
          // things that already exist. Continue on error.
          skipped++;
          const message = err instanceof Error ? err.message : String(err);
          // Only log if it's not a common "already exists" type error
          if (
            !message.includes('already exists') &&
            !message.includes('duplicate key') &&
            !message.includes('does not exist') &&
            !message.includes('relation') &&
            !message.includes('column')
          ) {
            console.log(`  [${user.slug}] Migration ${migration.name}: ${message.slice(0, 120)}`);
          }
        }
      }
      console.log(`[${user.slug}] Migrations: ${applied} applied, ${skipped} skipped (already exist or N/A)`);
    } else {
      console.log(`[${user.slug}] Existing tenant — skipping schema/migration step to avoid duplicate seed data`);
    }

    // ── 7. Create auth_users row ─────────────────────────────────────────
    const passwordHash = hashSync(user.password, BCRYPT_ROUNDS);

    const authResult = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
      return tx.unsafe(
        `INSERT INTO auth_users (email, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [user.email, passwordHash, user.role],
      );
    });

    const authUserId = authResult[0].id;
    console.log(`[${user.slug}] auth_users row ensured (id: ${authUserId}, email: ${user.email})`);

    // ── 8. Create profile row ────────────────────────────────────────────
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
      await tx.unsafe(
        `INSERT INTO profile (id, name, birth_date, metadata, onboarding_complete, tenant_slot)
         VALUES ($1, $2, '2000-01-01', $3, false, $4)
         ON CONFLICT (id) DO NOTHING`,
        [
          authUserId,
          user.label,
          JSON.stringify({
            checkin_morning: '09:00',
            checkin_evening: '22:00',
            weekly_review_day: 'sunday',
            weekly_review_time: '20:00',
            timezone: 'America/Sao_Paulo',
          }),
          user.slug,
        ],
      );
    });
    console.log(`[${user.slug}] Profile row ensured (name: ${user.label})`);

    // ── 9. Seed modules table inside tenant schema ───────────────────────
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
      for (const moduleId of MODULES) {
        await tx.unsafe(
          `INSERT INTO modules (id, enabled) VALUES ($1, false) ON CONFLICT (id) DO NOTHING`,
          [moduleId],
        );
      }
    });
    console.log(`[${user.slug}] ${MODULES.length} modules seeded in tenant schema`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('[seed-tenants] Done!');
  console.log('='.repeat(60));
  console.log(`Tenants created/verified: ${USERS.length}`);
  console.log('Schemas: ' + USERS.map((u) => `tenant_${u.slug}`).join(', '));
  console.log('\nNext steps:');
  console.log('  1. Set TEN{N}_DISCORD_BOT_TOKEN etc. in .env for each tenant');
  console.log('  2. Run: bun agent');
  console.log('  3. Each tenant will be auto-loaded by TenantManager');

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-tenants] Fatal error:', err);
  process.exit(1);
});
