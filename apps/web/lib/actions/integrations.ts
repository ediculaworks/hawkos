'use server';

import type { IntegrationProvider } from '@hawk/admin';
import { withAdminTenant } from '../supabase/with-admin-tenant';
import { getTenantPrivateBySlug } from '../tenants/cache-server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IntegrationSummary {
  provider: IntegrationProvider;
  enabled: boolean;
  configured: boolean;
  maskedHint: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mask a secret value for display: "sk-abc...xyz" */
function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/** Extract the most representative secret from a config for the masked hint. */
function getHintFromConfig(
  provider: IntegrationProvider,
  config: Record<string, unknown>,
): string | null {
  const keyMap: Record<string, string> = {
    discord: 'bot_token',
    openrouter: 'api_key',
    anthropic: 'api_key',
    groq: 'api_key',
    google: 'client_id',
    github: 'token',
    clickup: 'api_token',
  };
  const key = keyMap[provider];
  if (!key) return null;
  return maskSecret(config[key] as string | undefined);
}

/** Notify the agent to reload credentials after a change. */
async function notifyAgentReload(slug: string): Promise<void> {
  try {
    const tenant = await getTenantPrivateBySlug(slug);
    if (!tenant) return;

    const agentUrl = `http://localhost:${tenant.agentApiPort}`;
    const res = await fetch(`${agentUrl}/reload-credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tenant.agentApiSecret ? { Authorization: `Bearer ${tenant.agentApiSecret}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[integrations] Agent reload returned ${res.status}`);
    }
  } catch {
    // Agent offline — credentials will be loaded on next startup
    console.info('[integrations] Agent not reachable, skipping reload notification');
  }
}

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * Fetch all integrations for the current tenant.
 * Returns masked hints only — never full secrets.
 */
export async function fetchIntegrations(): Promise<IntegrationSummary[]> {
  return withAdminTenant(async ({ admin, tenantId, slug }) => {
    // 1. Get tenant for Discord/OpenRouter (stored on tenants table)
    const tenant = await admin.getTenantBySlug(slug);

    // 2. Get all integrations from tenant_integrations table
    const integrations = await admin.listTenantIntegrations(tenantId);

    const result: IntegrationSummary[] = [];

    // Discord — from tenants table (encrypted columns)
    const hasDiscord = !!tenant?.discord_config_encrypted;
    let discordHint: string | null = null;
    if (hasDiscord && tenant?.discord_config_encrypted && tenant.discord_config_iv) {
      try {
        const cfg = admin.getDecryptedIntegrationConfig({
          config_encrypted: tenant.discord_config_encrypted,
          config_iv: tenant.discord_config_iv,
        } as never) as Record<string, unknown>;
        discordHint = maskSecret(cfg.bot_token as string);
      } catch {
        discordHint = '••••••••';
      }
    }
    result.push({
      provider: 'discord',
      enabled: hasDiscord,
      configured: hasDiscord,
      maskedHint: discordHint,
    });

    // OpenRouter — from tenants table (encrypted columns)
    const hasOpenRouter = !!tenant?.openrouter_config_encrypted;
    let openrouterHint: string | null = null;
    if (hasOpenRouter && tenant?.openrouter_config_encrypted && tenant.openrouter_config_iv) {
      try {
        const cfg = admin.getDecryptedIntegrationConfig({
          config_encrypted: tenant.openrouter_config_encrypted,
          config_iv: tenant.openrouter_config_iv,
        } as never) as Record<string, unknown>;
        openrouterHint = maskSecret(cfg.api_key as string);
      } catch {
        openrouterHint = '••••••••';
      }
    }
    result.push({
      provider: 'openrouter',
      enabled: hasOpenRouter,
      configured: hasOpenRouter,
      maskedHint: openrouterHint,
    });

    // Other providers — from tenant_integrations table
    const otherProviders: IntegrationProvider[] = [
      'anthropic',
      'groq',
      'github',
      'clickup',
      'google',
    ];
    for (const provider of otherProviders) {
      const integration = integrations.find((i) => i.provider === provider);
      if (integration) {
        let hint: string | null = null;
        try {
          const cfg = admin.getDecryptedIntegrationConfig(integration);
          hint = getHintFromConfig(provider, cfg as Record<string, unknown>);
        } catch {
          hint = '••••••••';
        }
        result.push({
          provider,
          enabled: integration.enabled,
          configured: true,
          maskedHint: hint,
        });
      } else {
        result.push({
          provider,
          enabled: false,
          configured: false,
          maskedHint: null,
        });
      }
    }

    return result;
  });
}

/**
 * Fetch the full decrypted config for a specific integration.
 * Called only when the user opens the edit form.
 */
export async function fetchIntegrationConfig(
  provider: IntegrationProvider,
): Promise<{ config: Record<string, unknown>; enabled: boolean } | null> {
  return withAdminTenant(async ({ admin, tenantId, slug }) => {
    // Discord and OpenRouter are on the tenants table
    if (provider === 'discord' || provider === 'openrouter') {
      const tenant = await admin.getTenantBySlug(slug);
      if (!tenant) return null;

      const encData =
        provider === 'discord'
          ? tenant.discord_config_encrypted
          : tenant.openrouter_config_encrypted;
      const ivData =
        provider === 'discord' ? tenant.discord_config_iv : tenant.openrouter_config_iv;

      if (!encData || !ivData) return null;

      try {
        const cfg = admin.getDecryptedIntegrationConfig({
          config_encrypted: encData,
          config_iv: ivData,
        } as never);
        return { config: cfg as Record<string, unknown>, enabled: true };
      } catch {
        return null;
      }
    }

    // Other providers — from tenant_integrations
    const integration = await admin.getTenantIntegration(tenantId, provider);
    if (!integration) return null;

    const cfg = admin.getDecryptedIntegrationConfig(integration);
    return { config: cfg as Record<string, unknown>, enabled: integration.enabled };
  });
}

/**
 * Save/update an integration's config.
 */
export async function saveIntegration(
  provider: IntegrationProvider,
  config: Record<string, unknown>,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  return withAdminTenant(async ({ admin, tenantId, slug }) => {
    try {
      if (provider === 'discord') {
        await admin.updateTenantDiscordConfig(tenantId, config);
      } else if (provider === 'openrouter') {
        await admin.updateTenantOpenRouterConfig(tenantId, config);
      } else {
        await admin.upsertTenantIntegration(tenantId, provider, config, enabled);
      }

      await admin.logAudit(tenantId, 'api_call', {
        level: 'info',
        action: 'integration_saved',
        provider,
      });

      // Notify agent to reload credentials
      await notifyAgentReload(slug);

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });
}

/**
 * Delete an integration.
 */
export async function deleteIntegration(
  provider: IntegrationProvider,
): Promise<{ success: boolean; error?: string }> {
  return withAdminTenant(async ({ admin, tenantId, slug }) => {
    try {
      if (provider === 'discord') {
        await admin.updateTenantDiscordConfig(tenantId, {});
      } else if (provider === 'openrouter') {
        await admin.updateTenantOpenRouterConfig(tenantId, {});
      } else {
        await admin.deleteTenantIntegration(tenantId, provider);
      }

      await admin.logAudit(tenantId, 'api_call', {
        level: 'info',
        action: 'integration_deleted',
        provider,
      });

      await notifyAgentReload(slug);

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });
}

/**
 * Test an integration's credentials without saving.
 * All validation runs server-side.
 */
export async function testIntegration(
  provider: IntegrationProvider,
  config: Record<string, unknown>,
): Promise<{ success: boolean; error?: string; details?: string }> {
  try {
    switch (provider) {
      case 'discord': {
        const token = config.bot_token as string;
        if (!token) return { success: false, error: 'Bot token is required' };
        const res = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `Discord API: ${res.status}` };
        const data = (await res.json()) as { username: string; discriminator: string };
        return { success: true, details: `Bot: ${data.username}#${data.discriminator}` };
      }

      case 'openrouter': {
        const key = config.api_key as string;
        if (!key) return { success: false, error: 'API key is required' };
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `OpenRouter API: ${res.status}` };
        return { success: true, details: 'API key valid' };
      }

      case 'anthropic': {
        const key = config.api_key as string;
        if (!key) return { success: false, error: 'API key is required' };
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `Anthropic API: ${res.status}` };
        return { success: true, details: 'API key valid' };
      }

      case 'groq': {
        const key = config.api_key as string;
        if (!key) return { success: false, error: 'API key is required' };
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `Groq API: ${res.status}` };
        return { success: true, details: 'API key valid' };
      }

      case 'github': {
        const token = config.token as string;
        if (!token) return { success: false, error: 'Token is required' };
        const res = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `GitHub API: ${res.status}` };
        const data = (await res.json()) as { login: string };
        return { success: true, details: `User: ${data.login}` };
      }

      case 'clickup': {
        const token = config.api_token as string;
        if (!token) return { success: false, error: 'API token is required' };
        const res = await fetch('https://api.clickup.com/api/v2/team', {
          headers: { Authorization: token },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { success: false, error: `ClickUp API: ${res.status}` };
        return { success: true, details: 'API token valid' };
      }

      case 'google':
        return { success: false, error: 'Google OAuth not yet supported' };

      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}
