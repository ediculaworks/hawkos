import type { TenantPrivateConfig, TenantPublicConfig } from './tenants.ts';

let _tenants: TenantPrivateConfig[] = [];

export function loadTenants(tenants: TenantPrivateConfig[]): void {
  _tenants = tenants;
}

export function getAllTenantsPublic(): TenantPublicConfig[] {
  return _tenants.map(({ slug, label, supabaseUrl, supabaseAnonKey }) => ({
    slug,
    label,
    supabaseUrl,
    supabaseAnonKey,
  }));
}

export function getTenantPublic(slug: string): TenantPublicConfig | undefined {
  return getAllTenantsPublic().find((t) => t.slug === slug);
}

export function getTenantPrivate(slug: string): TenantPrivateConfig | undefined {
  return _tenants.find((t) => t.slug === slug);
}

export function isTenantLoaded(): boolean {
  return _tenants.length > 0;
}
