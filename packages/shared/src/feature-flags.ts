// ── Per-Tenant Feature Flags ──────────────────────────────────────────────
//
// Inspired by prompts.chat's config pattern.
// Flags are stored in tenants.feature_flags JSONB column.
// Defaults defined here, overridden by DB values per tenant.

export const DEFAULT_FEATURE_FLAGS = {
  // Wave 4
  'tool-approval': true,
  'hybrid-search': true,
  'frecency-sidebar': true,
  'activity-feed-widget': true,
  'secret-redaction': true,
  'prompt-injection-scanning': true,
  'silent-cron': true,
  'platform-hints': true,

  // Wave 5
  'mcp-client': true,
  'mcp-server': true,
  'sse-streaming': true,
  'ssrf-validation': true,
  'oauth-auto-refresh': true,
  'worker-token-tracking': true,
  'google-calendar-sync': false,
  webhooks: false,

  // Wave 6
  'iterative-summaries': true,
  'rrf-hybrid-search': true,
  'credential-pool': true,
  'cost-aware-routing': true,
  'context-compression': false,
  'agentic-rag': false,

  // Wave 7
  'context-references': true,
  'typed-sse-packets': true,
  'multi-channel': true,
  'plugin-sdk': true,
} as const;

export type FeatureFlagName = keyof typeof DEFAULT_FEATURE_FLAGS;

export type FeatureFlags = Record<string, boolean>;

/**
 * Resolve a feature flag value. Tenant overrides take precedence over defaults.
 */
export function getFeatureFlag(flag: FeatureFlagName, tenantFlags?: FeatureFlags | null): boolean {
  if (tenantFlags && flag in tenantFlags) {
    return Boolean(tenantFlags[flag]);
  }
  return DEFAULT_FEATURE_FLAGS[flag];
}

/**
 * Resolve all flags for a tenant (defaults merged with overrides).
 */
export function resolveAllFlags(
  tenantFlags?: FeatureFlags | null,
): Record<FeatureFlagName, boolean> {
  const resolved = { ...DEFAULT_FEATURE_FLAGS };
  if (tenantFlags) {
    for (const [key, value] of Object.entries(tenantFlags)) {
      if (key in resolved) {
        (resolved as Record<string, boolean>)[key] = Boolean(value);
      }
    }
  }
  return resolved;
}

/**
 * List only flags that differ from defaults (for compact storage).
 */
export function diffFromDefaults(tenantFlags: FeatureFlags): FeatureFlags {
  const diff: FeatureFlags = {};
  for (const [key, value] of Object.entries(tenantFlags)) {
    if (key in DEFAULT_FEATURE_FLAGS) {
      const defaultVal = DEFAULT_FEATURE_FLAGS[key as FeatureFlagName];
      if (Boolean(value) !== defaultVal) {
        diff[key] = Boolean(value);
      }
    }
  }
  return diff;
}
