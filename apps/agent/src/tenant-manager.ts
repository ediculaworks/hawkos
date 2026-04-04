import type { ScheduledTask } from 'node-cron';
import { loadAllActiveTenants, loadTenantCredentials } from './credential-manager.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TenantCredentials {
  schemaName: string;
  slug: string;
  keySalt: string | null;
  discordConfig?: {
    bot_token?: string;
    client_id?: string;
    guild_id?: string;
    channel_id?: string;
    user_id?: string;
    channel_map?: string;
  };
  openrouterConfig?: {
    api_key?: string;
    model?: string;
  };
  integrations?: Map<string, Record<string, string>>;
}

export interface TenantContext {
  slug: string;
  schemaName: string;
  credentials: TenantCredentials;
  /** Per-tenant Discord.js Client — set by discord.ts after connect */
  discordClient?: unknown;
  /** Per-tenant cron tasks — stopped on tenant removal */
  cronTasks: ScheduledTask[];
  /** Tenant lifecycle status */
  status: 'booting' | 'active' | 'error' | 'stopped';
  /** Error message if status === 'error' */
  lastError?: string;
}

// ── TenantManager ────────────────────────────────────────────────────────────

class TenantManager {
  private tenants = new Map<string, TenantContext>();

  /** Load all active tenants from admin schema. Called once on agent startup. */
  async loadAll(): Promise<void> {
    const credentials = await loadAllActiveTenants();

    if (credentials.length === 0) {
      console.warn('[tenant-manager] No active tenants found in admin schema');
      return;
    }

    for (const cred of credentials) {
      const ctx: TenantContext = {
        slug: cred.slug,
        schemaName: cred.schemaName,
        credentials: cred,
        cronTasks: [],
        status: 'booting',
      };
      this.tenants.set(cred.slug, ctx);
    }

    console.log(
      `[tenant-manager] Loaded ${credentials.length} tenant(s): ${credentials.map((c) => c.slug).join(', ')}`,
    );
  }

  /** Hot-load a single tenant (called after onboarding creates a new tenant). */
  async addTenant(slug: string): Promise<TenantContext> {
    // If already loaded, remove first
    if (this.tenants.has(slug)) {
      await this.removeTenant(slug);
    }

    const cred = await loadTenantCredentials(slug);
    const ctx: TenantContext = {
      slug: cred.slug,
      schemaName: cred.schemaName,
      credentials: cred,
      cronTasks: [],
      status: 'booting',
    };
    this.tenants.set(slug, ctx);
    console.log(`[tenant-manager] Added tenant: ${slug} (schema: ${cred.schemaName})`);
    return ctx;
  }

  /** Disconnect and cleanup a tenant (stops Discord, crons). */
  async removeTenant(slug: string): Promise<void> {
    const ctx = this.tenants.get(slug);
    if (!ctx) return;

    ctx.status = 'stopped';

    // Stop all cron tasks
    for (const task of ctx.cronTasks) {
      task.stop();
    }
    ctx.cronTasks.length = 0;

    // Disconnect Discord client if set
    if (
      ctx.discordClient &&
      typeof (ctx.discordClient as { destroy?: () => void }).destroy === 'function'
    ) {
      try {
        (ctx.discordClient as { destroy: () => void }).destroy();
      } catch (err) {
        console.warn(`[tenant-manager] Failed to destroy Discord client for ${slug}:`, err);
      }
    }

    this.tenants.delete(slug);
    console.log(`[tenant-manager] Removed tenant: ${slug}`);
  }

  /** Get a tenant context by slug. */
  getTenant(slug: string): TenantContext | undefined {
    return this.tenants.get(slug);
  }

  /** Get all tenants (any status). */
  getAll(): TenantContext[] {
    return Array.from(this.tenants.values());
  }

  /** Get all active tenants. */
  getAllActive(): TenantContext[] {
    return Array.from(this.tenants.values()).filter(
      (t) => t.status === 'active' || t.status === 'booting',
    );
  }

  /** Mark tenant as active (called after successful startup). */
  markActive(slug: string): void {
    const ctx = this.tenants.get(slug);
    if (ctx) ctx.status = 'active';
  }

  /** Mark tenant as errored. */
  markError(slug: string, error: string): void {
    const ctx = this.tenants.get(slug);
    if (ctx) {
      ctx.status = 'error';
      ctx.lastError = error;
    }
  }

  /** Number of loaded tenants. */
  get size(): number {
    return this.tenants.size;
  }

  /** Graceful shutdown: remove all tenants. */
  async shutdownAll(): Promise<void> {
    const slugs = Array.from(this.tenants.keys());
    await Promise.allSettled(slugs.map((slug) => this.removeTenant(slug)));
    console.log('[tenant-manager] All tenants shut down');
  }
}

/** Singleton TenantManager instance. */
export const tenantManager = new TenantManager();
