interface HawkTenantGlobals {
  slug: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  agentApiPort: number;
}

interface Window {
  __HAWK_TENANT__?: HawkTenantGlobals;
}
