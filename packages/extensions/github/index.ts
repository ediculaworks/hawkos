import { buildAuthorizationUrl, exchangeCodeForTokens } from '../core/oauth';
import type { OAuthProviderConfig } from '../core/oauth';
import type {
  ExtensionConnection,
  ExtensionDefinition,
  OAuthTokens,
  SyncResult,
} from '../core/types';
import { syncGitHub } from './sync';

function getOAuthConfig(): OAuthProviderConfig {
  return {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    scopes: ['repo', 'read:user', 'read:org'],
  };
}

export const githubExtension: ExtensionDefinition = {
  id: 'github',
  name: 'GitHub',
  description: 'Sync repos, PRs and issues from GitHub',
  icon: 'github',
  authMethod: 'oauth2',
  scopes: ['repo', 'read:user', 'read:org'],
  relatedModules: ['career'],
  syncIntervalMinutes: 30,

  getAuthorizationUrl(redirectUri: string, state: string): string {
    return buildAuthorizationUrl(getOAuthConfig(), redirectUri, state);
  },

  async handleCallback(code: string, redirectUri: string): Promise<OAuthTokens> {
    return exchangeCodeForTokens(getOAuthConfig(), code, redirectUri);
  },

  async sync(connection: ExtensionConnection): Promise<SyncResult> {
    return syncGitHub(connection);
  },
};
