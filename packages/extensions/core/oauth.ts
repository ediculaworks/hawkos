import type { OAuthTokens } from './types';

export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

/** Build the full authorization URL the user should be redirected to */
export function buildAuthorizationUrl(
  config: OAuthProviderConfig,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

/** Exchange an authorization code for tokens */
export async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  code: string,
  redirectUri: string,
): Promise<OAuthTokens> {
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed (${res.status}): ${text}`);
  }

  return (await res.json()) as OAuthTokens;
}

/** Refresh an expired access token */
export async function refreshAccessToken(
  config: OAuthProviderConfig,
  refreshToken: string,
): Promise<OAuthTokens> {
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token refresh failed (${res.status}): ${text}`);
  }

  return (await res.json()) as OAuthTokens;
}
