interface HawkTenantGlobals {
  slug: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  agentApiPort: number;
  agentApiSecret: string;
}

interface Window {
  __HAWK_TENANT__?: HawkTenantGlobals;
}
