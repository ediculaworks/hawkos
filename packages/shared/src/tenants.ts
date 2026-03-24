// ── Tenant Configuration Types ──────────────────────────────────────────────

/** Public config — safe to expose to browser */
export interface TenantPublicConfig {
  slug: string;
  label: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/** Full config — server-only (includes secrets) */
export interface TenantPrivateConfig extends TenantPublicConfig {
  supabaseServiceRoleKey: string;
  agentApiPort: number;
  agentApiSecret: string;
}

export interface TenantsFile {
  tenants: TenantPrivateConfig[];
}
