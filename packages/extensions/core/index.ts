export { extensionRegistry } from './registry';
export {
  getConnection,
  getAllConnections,
  upsertConnection,
  updateConnectionStatus,
  deleteConnection,
  getConnectedExtensionIds,
} from './credentials';
export { buildAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken } from './oauth';
export type {
  ExtensionId,
  AuthMethod,
  ConnectionStatus,
  OAuthTokens,
  SyncResult,
  ExtensionConnection,
  ExtensionDefinition,
  ExtensionView,
} from './types';
export type { OAuthProviderConfig } from './oauth';
export {
  registerToken,
  getValidToken,
  revokeToken,
  setTokenPersister,
  getTokenStatus,
} from './token-manager';
export {
  registerPlugin,
  initPlugin,
  initAllPlugins,
  unloadPlugin,
  unloadAllPlugins,
  reloadPlugin,
  getPlugins,
  getPluginTools,
  collectPluginContext,
} from './plugin-sdk';
export type {
  PluginManifest,
  PluginInstance,
  PluginPermission,
  PluginStatus,
} from './plugin-sdk';
export {
  registerProvider,
  getProvider,
  getProvidersByModule,
  listProviders,
  getConnectedProviders,
  syncModule,
} from './provider';
export type {
  DataProvider,
  ProviderStatus,
  ProviderMetadata,
  ProviderSyncResult,
} from './provider';
