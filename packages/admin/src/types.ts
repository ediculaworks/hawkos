// Admin Supabase Types - Hawk OS Multi-Tenant Platform

export type TenantStatus = 'pending' | 'active' | 'inactive' | 'suspended';
export type IntegrationProvider =
  | 'discord'
  | 'openrouter'
  | 'google'
  | 'anthropic'
  | 'github'
  | 'clickup'
  | 'groq';
export type AuditEventType =
  | 'login'
  | 'token_usage'
  | 'api_call'
  | 'automation_run'
  | 'module_enabled'
  | 'module_disabled'
  | 'migration_applied'
  | 'error';
export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error';
export type AdminRole = 'admin' | 'viewer';

export interface Tenant {
  id: string;
  slug: string;
  label: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_key_encrypted: string;
  supabase_service_key_iv: string;
  discord_config: DiscordConfig;
  openrouter_config: OpenRouterConfig;
  agent_port: number;
  agent_secret: string | null;
  status: TenantStatus;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TenantInsert {
  slug: string;
  label: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_key_encrypted: string;
  supabase_service_key_iv: string;
  discord_config?: DiscordConfig;
  openrouter_config?: OpenRouterConfig;
  agent_port: number;
  agent_secret?: string;
  created_by?: string;
}

export interface TenantUpdate {
  label?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_service_key_encrypted?: string;
  supabase_service_key_iv?: string;
  discord_config?: DiscordConfig;
  openrouter_config?: OpenRouterConfig;
  agent_secret?: string;
  status?: TenantStatus;
  onboarding_completed_at?: string;
}

export interface DiscordConfig {
  bot_token?: string;
  client_id?: string;
  guild_id?: string;
  channel_id?: string;
  authorized_user_id?: string;
}

export interface OpenRouterConfig {
  api_key?: string;
  model?: string;
  max_tokens?: number;
}

export interface TenantIntegration {
  id: string;
  tenant_id: string;
  provider: IntegrationProvider;
  config_encrypted: Record<string, unknown>;
  config_iv: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantModule {
  id: string;
  tenant_id: string;
  module_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantAudit {
  id: number;
  tenant_id: string;
  event_type: AuditEventType;
  severity: AuditSeverity;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface TenantMetrics {
  id: number;
  tenant_id: string;
  date: string;
  tokens_used: number;
  tokens_cost_usd: number;
  api_calls: number;
  automation_runs: number;
  active_users: number;
  login_count: number;
  modules_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  user_id: string;
  email: string;
  role: AdminRole;
  created_at: string;
  invited_by: string | null;
}

export interface TenantAvailability {
  slot_number: number;
  slot_name: string;
  status: 'available' | 'occupied' | 'pending';
  tenant_id: string | null;
  tenant_label: string | null;
  tenant_status: TenantStatus | null;
  onboarding_completed_at: string | null;
  created_at: string | null;
}

export interface TenantWithMetrics extends Tenant {
  metrics_today?: TenantMetrics;
  metrics_month?: TenantMetrics;
  modules_count?: number;
  last_activity?: string;
}

export interface ValidateCredentialsResult {
  valid: boolean;
  error?: string;
  supabase_version?: string;
  has_migrations?: boolean;
}

export interface CreateTenantResult {
  success: boolean;
  tenant?: Tenant;
  error?: string;
}
