/**
 * DataProvider interface — OpenBB-inspired standardized data source abstraction.
 *
 * TODO: NOT YET INTEGRATED — interface and registry exist but zero concrete providers.
 * To activate: implement first provider (e.g., finances/csv-import) and register it.
 *
 * Each provider connects to an external data source (bank API, wearable, CSV, etc.)
 * and exposes a unified query/sync interface. Providers register with the extension
 * system and can be discovered by module.
 *
 * "Connect once, consume everywhere" — same Transaction type whether from
 * Nubank API, CSV import, or manual entry.
 */

// ── Types ───────────────────────────────────────────────────

export type ProviderStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'syncing';

export interface ProviderSyncResult {
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
  syncedAt: string;
}

export interface ProviderMetadata {
  lastSyncAt?: string;
  lastError?: string;
  totalRecords?: number;
  version?: string;
}

/**
 * Base DataProvider interface — all data source integrations implement this.
 *
 * TQuery: the query parameters type (e.g., { startDate: string; endDate: string })
 * TResult: the result item type (e.g., Transaction, HealthObservation)
 */
export interface DataProvider<TQuery = Record<string, unknown>, TResult = Record<string, unknown>> {
  /** Unique provider ID: module/source (e.g., "finances/nubank") */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Which Hawk OS module this provider feeds */
  readonly module: string;
  /** Provider description */
  readonly description: string;
  /** Current connection status */
  status: ProviderStatus;
  /** Provider metadata (last sync, etc.) */
  metadata: ProviderMetadata;

  /**
   * Connect to the data source with provided credentials.
   * Validates credentials and establishes connection.
   */
  connect(credentials: Record<string, string>): Promise<void>;

  /**
   * Disconnect from the data source.
   */
  disconnect(): Promise<void>;

  /**
   * Full sync — pull all new/updated data from the source.
   * Should be idempotent (safe to call multiple times).
   */
  sync(): Promise<ProviderSyncResult>;

  /**
   * Query data from the source with specific parameters.
   * For real-time queries (not cached data).
   */
  query(params: TQuery): Promise<TResult[]>;

  /**
   * Check if the connection is still valid (e.g., token not expired).
   */
  healthCheck(): Promise<boolean>;
}

// ── Provider Registry ───────────────────────────────────────

const _providers = new Map<string, DataProvider>();
const _syncingModules = new Set<string>();

/**
 * Register a data provider.
 */
export function registerProvider(provider: DataProvider): void {
  _providers.set(provider.id, provider);
}

/**
 * Get a provider by ID.
 */
export function getProvider(id: string): DataProvider | undefined {
  return _providers.get(id);
}

/**
 * List all providers for a specific module.
 */
export function getProvidersByModule(module: string): DataProvider[] {
  return [..._providers.values()].filter((p) => p.module === module);
}

/**
 * List all registered providers.
 */
export function listProviders(): DataProvider[] {
  return [..._providers.values()];
}

/**
 * Get all connected (active) providers.
 */
export function getConnectedProviders(): DataProvider[] {
  return [..._providers.values()].filter((p) => p.status === 'connected');
}

/**
 * Sync all connected providers for a module.
 * Returns results keyed by provider ID.
 */
export async function syncModule(module: string): Promise<Record<string, ProviderSyncResult>> {
  // Module-level lock: prevent concurrent syncs for the same module
  if (_syncingModules.has(module)) return {};
  _syncingModules.add(module);

  try {
    const providers = getProvidersByModule(module).filter((p) => p.status === 'connected');
    const results: Record<string, ProviderSyncResult> = {};

    const settled = await Promise.allSettled(
      providers.map(async (p) => {
        p.status = 'syncing';
        p.metadata ??= {};
        try {
          const result = await p.sync();
          p.status = 'connected';
          p.metadata.lastSyncAt = new Date().toISOString();
          return { id: p.id, result };
        } catch (err) {
          p.status = 'error';
          p.metadata.lastError = String(err);
          throw err;
        }
      }),
    );

    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) {
        results[s.value.id] = s.value.result;
      }
    }

    return results;
  } finally {
    _syncingModules.delete(module);
  }
}
