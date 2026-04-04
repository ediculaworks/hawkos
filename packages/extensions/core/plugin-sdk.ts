/**
 * Plugin SDK — lifecycle hooks + dynamic discovery.
 *
 * TODO: NOT YET INTEGRATED — initAllPlugins() is never called, no plugins registered.
 * To activate: call initAllPlugins() in agent startup and register at least one plugin.
 *
 * Provides a standard interface for building Hawk OS plugins.
 * Plugins can register tools, hooks, automations, and context providers.
 *
 * Lifecycle: discover → init → ready → (reload) → unload
 *
 * Inspired by OpenClaw's Plugin SDK pattern.
 */

import { createLogger } from '@hawk/shared';

const logger = createLogger('plugin-sdk');

// ── Plugin Definition ────────────────────────────────────────────────────────

export interface PluginManifest {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Short description */
  description: string;
  /** Author name or org */
  author?: string;
  /** Related Hawk OS modules */
  modules?: string[];
  /** Required permissions */
  permissions?: PluginPermission[];
  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[];
}

export type PluginPermission =
  | 'tools:register' // Can register new tools
  | 'hooks:register' // Can register hooks
  | 'context:inject' // Can inject context into LLM
  | 'db:read' // Can read from database
  | 'db:write' // Can write to database
  | 'network:fetch' // Can make external HTTP requests
  | 'automation:register'; // Can register cron jobs

export type PluginStatus = 'discovered' | 'initializing' | 'ready' | 'error' | 'unloaded';

export interface PluginInstance {
  manifest: PluginManifest;
  status: PluginStatus;
  error?: string;
  loadedAt?: number;

  /** Called once when plugin is first loaded. Setup resources. */
  init?(): Promise<void>;

  /** Called after init completes. Plugin is fully operational. */
  ready?(): Promise<void>;

  /** Called when plugin config changes. Re-read settings without full reload. */
  reload?(): Promise<void>;

  /** Called when plugin is unloaded. Cleanup resources. */
  unload?(): Promise<void>;

  /** Return tools this plugin provides (for tool routing). */
  getTools?(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<string>;
  }>;

  /** Return context to inject for relevant messages. */
  getContext?(message: string): Promise<string | null>;
}

// ── Plugin Registry ──────────────────────────────────────────────────────────

const _plugins = new Map<string, PluginInstance>();

/**
 * Register a plugin with the SDK.
 */
export function registerPlugin(plugin: PluginInstance): void {
  if (_plugins.has(plugin.manifest.id)) {
    logger.warn({ pluginId: plugin.manifest.id }, 'Plugin already registered, replacing');
  }
  plugin.status = 'discovered';
  _plugins.set(plugin.manifest.id, plugin);
  logger.info(
    { pluginId: plugin.manifest.id, version: plugin.manifest.version },
    'Plugin registered',
  );
}

/**
 * Initialize a specific plugin.
 */
export async function initPlugin(pluginId: string): Promise<boolean> {
  const plugin = _plugins.get(pluginId);
  if (!plugin) return false;

  // Check dependencies
  if (plugin.manifest.dependencies) {
    for (const dep of plugin.manifest.dependencies) {
      const depPlugin = _plugins.get(dep);
      if (!depPlugin || depPlugin.status !== 'ready') {
        plugin.status = 'error';
        plugin.error = `Missing dependency: ${dep}`;
        logger.error({ pluginId, dependency: dep }, 'Plugin dependency not ready');
        return false;
      }
    }
  }

  try {
    plugin.status = 'initializing';
    if (plugin.init) await plugin.init();
    if (plugin.ready) await plugin.ready();
    plugin.status = 'ready';
    plugin.loadedAt = Date.now();
    logger.info({ pluginId }, 'Plugin initialized');
    return true;
  } catch (err) {
    plugin.status = 'error';
    plugin.error = err instanceof Error ? err.message : String(err);
    logger.error({ pluginId, err: plugin.error }, 'Plugin initialization failed');
    return false;
  }
}

/**
 * Initialize all registered plugins (respects dependency order).
 */
export async function initAllPlugins(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Simple topological sort: init plugins without deps first, then dependents
  const noDeps = [..._plugins.values()].filter(
    (p) => !p.manifest.dependencies || p.manifest.dependencies.length === 0,
  );
  const withDeps = [..._plugins.values()].filter(
    (p) => p.manifest.dependencies && p.manifest.dependencies.length > 0,
  );

  for (const plugin of [...noDeps, ...withDeps]) {
    const ok = await initPlugin(plugin.manifest.id);
    if (ok) success++;
    else failed++;
  }

  return { success, failed };
}

/**
 * Unload a specific plugin.
 */
export async function unloadPlugin(pluginId: string): Promise<void> {
  const plugin = _plugins.get(pluginId);
  if (!plugin) return;

  try {
    if (plugin.unload) await plugin.unload();
  } catch (err) {
    logger.error({ pluginId, err }, 'Plugin unload error');
  }

  plugin.status = 'unloaded';
  logger.info({ pluginId }, 'Plugin unloaded');
}

/**
 * Unload all plugins.
 */
export async function unloadAllPlugins(): Promise<void> {
  for (const pluginId of _plugins.keys()) {
    await unloadPlugin(pluginId);
  }
}

/**
 * Reload a plugin (unload + re-init or just reload handler).
 */
export async function reloadPlugin(pluginId: string): Promise<boolean> {
  const plugin = _plugins.get(pluginId);
  if (!plugin) return false;

  if (plugin.reload) {
    try {
      await plugin.reload();
      logger.info({ pluginId }, 'Plugin reloaded');
      return true;
    } catch (err) {
      logger.error({ pluginId, err }, 'Plugin reload failed');
      return false;
    }
  }

  // Fallback: full unload + re-init
  await unloadPlugin(pluginId);
  return initPlugin(pluginId);
}

// ── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Get all registered plugins and their status.
 */
export function getPlugins(): Array<{
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  error?: string;
}> {
  return [..._plugins.values()].map((p) => ({
    id: p.manifest.id,
    name: p.manifest.name,
    version: p.manifest.version,
    status: p.status,
    error: p.error,
  }));
}

/**
 * Get all tools from ready plugins.
 */
export function getPluginTools(): Array<{
  pluginId: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}> {
  const tools: Array<{
    pluginId: string;
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<string>;
  }> = [];

  for (const plugin of _plugins.values()) {
    if (plugin.status !== 'ready' || !plugin.getTools) continue;
    for (const tool of plugin.getTools()) {
      tools.push({ pluginId: plugin.manifest.id, ...tool });
    }
  }

  return tools;
}

/**
 * Collect context from all ready plugins for a given message.
 */
export async function collectPluginContext(message: string): Promise<string> {
  const parts: string[] = [];

  for (const plugin of _plugins.values()) {
    if (plugin.status !== 'ready' || !plugin.getContext) continue;
    try {
      const ctx = await plugin.getContext(message);
      if (ctx) parts.push(`### ${plugin.manifest.name}\n${ctx}`);
    } catch {
      // Plugin context failure shouldn't break the handler
    }
  }

  return parts.length > 0 ? `## Plugin Context\n\n${parts.join('\n\n')}` : '';
}
