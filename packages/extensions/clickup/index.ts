import { exchangeCodeForTokens } from '../core/oauth';
import type { OAuthProviderConfig } from '../core/oauth';
import type {
  ExtensionConnection,
  ExtensionDefinition,
  OAuthTokens,
  SyncResult,
} from '../core/types';
import { syncClickUp } from './sync';

function getOAuthConfig(): OAuthProviderConfig {
  return {
    authorizeUrl: 'https://app.clickup.com/api',
    tokenUrl: 'https://api.clickup.com/api/v2/oauth/token',
    clientId: process.env.CLICKUP_CLIENT_ID ?? '',
    clientSecret: process.env.CLICKUP_CLIENT_SECRET ?? '',
    scopes: [],
  };
}

export const clickupExtension: ExtensionDefinition = {
  id: 'clickup',
  name: 'ClickUp',
  description: 'Sync tasks and spaces from ClickUp',
  icon: 'list-checks',
  authMethod: 'oauth2',
  scopes: [],
  relatedModules: ['objectives'],
  syncIntervalMinutes: 15,

  getAuthorizationUrl(redirectUri: string, state: string): string {
    // ClickUp OAuth uses a slightly different URL format
    const params = new URLSearchParams({
      client_id: getOAuthConfig().clientId,
      redirect_uri: redirectUri,
      state,
    });
    return `https://app.clickup.com/api?${params.toString()}`;
  },

  async handleCallback(code: string, redirectUri: string): Promise<OAuthTokens> {
    return exchangeCodeForTokens(getOAuthConfig(), code, redirectUri);
  },

  async validateApiKey(key: string): Promise<boolean> {
    const res = await fetch('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: key },
    });
    return res.ok;
  },

  async sync(connection: ExtensionConnection): Promise<SyncResult> {
    return syncClickUp(connection);
  },
};
