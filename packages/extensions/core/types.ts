// ─── Extension System Types ──────────────────────────────────────

export type ExtensionId = 'google-calendar' | 'google-drive' | 'notion' | 'clickup' | 'github';

export type AuthMethod = 'oauth2' | 'api_key';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

export interface SyncResult {
  synced: number;
  errors: string[];
  nextSyncAt?: Date;
}

export interface ExtensionConnection {
  id: string;
  extension_id: ExtensionId;
  status: ConnectionStatus;
  access_token: string | null;
  refresh_token: string | null;
  api_key: string | null;
  token_expiry: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  sync_enabled: boolean;
  sync_interval_minutes: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExtensionDefinition {
  id: ExtensionId;
  name: string;
  description: string;
  icon: string;
  authMethod: AuthMethod;
  scopes?: string[];
  relatedModules: string[];
  syncIntervalMinutes?: number;

  getAuthorizationUrl?(redirectUri: string, state: string): string;
  handleCallback?(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshToken?(refreshToken: string): Promise<OAuthTokens>;
  validateApiKey?(key: string): Promise<boolean>;
  sync?(connection: ExtensionConnection): Promise<SyncResult>;
}

/** Flat view returned to the UI — merges definition + connection status */
export interface ExtensionView {
  id: ExtensionId;
  name: string;
  description: string;
  icon: string;
  authMethod: AuthMethod;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  syncEnabled: boolean;
  connected: boolean;
}
