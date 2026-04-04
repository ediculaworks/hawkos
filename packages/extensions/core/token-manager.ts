/**
 * OAuth Token Manager — auto-refresh with 60s buffer.
 *
 * Manages token lifecycle across multiple OAuth providers.
 * Automatically refreshes tokens before they expire (60s buffer).
 * Prevents concurrent refresh races with a refresh lock.
 *
 * Inspired by Onyx's OAuth token manager pattern.
 */

import { createLogger } from '@hawk/shared';
import type { OAuthProviderConfig } from './oauth.ts';
import { refreshAccessToken } from './oauth.ts';
import type { OAuthTokens } from './types.ts';

const logger = createLogger('token-manager');

/** Buffer time before expiry to trigger auto-refresh (60 seconds) */
const REFRESH_BUFFER_MS = 60 * 1000;

/** Max refresh retries before marking as expired */
const MAX_REFRESH_RETRIES = 3;

interface ManagedToken {
  extensionId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // unix timestamp ms
  providerConfig: OAuthProviderConfig;
  refreshPromise: Promise<OAuthTokens> | null; // prevent concurrent refreshes
  retryCount: number;
}

type TokenPersister = (
  extensionId: string,
  tokens: { access_token: string; refresh_token?: string; expires_at: string },
) => Promise<void>;

// ── Singleton Registry ───────────────────────────────────────────────────────

const _tokens = new Map<string, ManagedToken>();
let _persister: TokenPersister | null = null;

/**
 * Set the function used to persist refreshed tokens to the database.
 * Must be called during setup before any token operations.
 */
export function setTokenPersister(fn: TokenPersister): void {
  _persister = fn;
}

/**
 * Register a token for management.
 * Call after OAuth exchange or when loading saved tokens from DB.
 */
export function registerToken(
  extensionId: string,
  tokens: OAuthTokens,
  providerConfig: OAuthProviderConfig,
): void {
  const expiresAt = tokens.expires_in
    ? Date.now() + tokens.expires_in * 1000
    : Date.now() + 3600 * 1000; // default 1h

  _tokens.set(extensionId, {
    extensionId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt,
    providerConfig,
    refreshPromise: null,
    retryCount: 0,
  });

  logger.info({ extensionId, expiresIn: tokens.expires_in }, 'Token registered');
}

/**
 * Get a valid access token for an extension.
 * Auto-refreshes if within 60s of expiry.
 * Returns null if token is expired and cannot be refreshed.
 */
export async function getValidToken(extensionId: string): Promise<string | null> {
  const managed = _tokens.get(extensionId);
  if (!managed) return null;

  // Check if token needs refresh (expired or within buffer)
  if (Date.now() >= managed.expiresAt - REFRESH_BUFFER_MS) {
    if (!managed.refreshToken) {
      logger.warn({ extensionId }, 'Token expired and no refresh token available');
      return null;
    }

    // Refresh (with lock to prevent concurrent refreshes)
    const refreshed = await refreshManagedToken(managed);
    if (!refreshed) return null;
  }

  return managed.accessToken;
}

/**
 * Revoke/remove a managed token (on disconnect).
 */
export function revokeToken(extensionId: string): void {
  _tokens.delete(extensionId);
  logger.info({ extensionId }, 'Token revoked');
}

/**
 * Get token status for monitoring/debugging.
 */
export function getTokenStatus(extensionId: string): {
  registered: boolean;
  expiresAt: number | null;
  expiresIn: number | null;
  needsRefresh: boolean;
} {
  const managed = _tokens.get(extensionId);
  if (!managed) {
    return { registered: false, expiresAt: null, expiresIn: null, needsRefresh: false };
  }
  const expiresIn = managed.expiresAt - Date.now();
  return {
    registered: true,
    expiresAt: managed.expiresAt,
    expiresIn,
    needsRefresh: expiresIn <= REFRESH_BUFFER_MS,
  };
}

// ── Internal ─────────────────────────────────────────────────────────────────

async function refreshManagedToken(managed: ManagedToken): Promise<boolean> {
  // If already refreshing, wait for that promise
  if (managed.refreshPromise) {
    try {
      await managed.refreshPromise;
      return true;
    } catch {
      return false;
    }
  }

  if (managed.retryCount >= MAX_REFRESH_RETRIES) {
    logger.error(
      { extensionId: managed.extensionId, retries: managed.retryCount },
      'Max refresh retries exceeded',
    );
    return false;
  }

  // Lock: set refresh promise
  managed.refreshPromise = refreshAccessToken(managed.providerConfig, managed.refreshToken!);

  try {
    const newTokens = await managed.refreshPromise;

    managed.accessToken = newTokens.access_token;
    if (newTokens.refresh_token) {
      managed.refreshToken = newTokens.refresh_token;
    }
    managed.expiresAt = newTokens.expires_in
      ? Date.now() + newTokens.expires_in * 1000
      : Date.now() + 3600 * 1000;
    managed.retryCount = 0;

    logger.info(
      { extensionId: managed.extensionId, expiresIn: newTokens.expires_in },
      'Token refreshed',
    );

    // Persist to DB
    if (_persister) {
      _persister(managed.extensionId, {
        access_token: managed.accessToken,
        refresh_token: managed.refreshToken ?? undefined,
        expires_at: new Date(managed.expiresAt).toISOString(),
      }).catch((err) =>
        logger.error(
          { extensionId: managed.extensionId, err },
          'Failed to persist refreshed token',
        ),
      );
    }

    return true;
  } catch (err) {
    managed.retryCount++;
    logger.error(
      { extensionId: managed.extensionId, err, retry: managed.retryCount },
      'Token refresh failed',
    );
    return false;
  } finally {
    managed.refreshPromise = null;
  }
}
