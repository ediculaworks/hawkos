// Must be first import — intercepts console.* to fill the in-memory log buffer
import './log-buffer.js';
import { initModuleCentroids } from '@hawk/context-engine';
import { withSchema } from '@hawk/db';
import { trainCategorizer } from '@hawk/module-finances/categorizer';
import { trainPredictionModels } from '@hawk/module-health/predictor';
import { computeAdaptiveHalfLives, learnImportanceWeights } from '@hawk/module-memory';
import { loadConfig } from '@hawk/shared';
import cron, { type ScheduledTask } from 'node-cron';
import { startAlertChecker } from './alerts.js';
import { stopApiServer } from './api/server.js';
import { startAlertsCron } from './automations/alerts.js';
import { setAnalyticsNotifier } from './automations/analytics.js';
import { startBackupCron } from './automations/backup.js';
import { startCheckinCrons } from './automations/daily-checkin.js';
import { setDemandBroadcast, startDemandExecutorCron } from './automations/demand-executor.js';
import { startExtensionSyncCron } from './automations/extension-sync.js';
import { startGapScannerCron } from './automations/gap-scanner.js';
import { startJobMonitorCron } from './automations/job-monitor.js';
import { startMemoryForgetterCron } from './automations/memory-forgetter.js';
import { startMonitorCron } from './automations/monitor.js';
import { startNetWorthSnapshotCron } from './automations/net-worth-snapshot.js';
import { runSessionCompactor } from './automations/session-compactor.js';
import { startStreakGuardianCron } from './automations/streak-guardian.js';
import { startWeeklyReviewCron } from './automations/weekly-review.js';
import { connectDiscordForTenant, discordChannel } from './channels/discord-adapter.js';
import { getMainChannelId, sendToChannel } from './channels/discord.js';
import { channelRegistry } from './channels/registry.js';
import { setupContextModules } from './context-setup.js';
import { initializeFromAdminDb } from './credential-manager.js';
import { registerActivitySubscribers } from './event-subscribers/activity-logger.js';
import {
  hookRegistry,
  sessionEndMemoryHook,
  sessionStartHook,
  toolCallWebSocketHook,
  toolLoggerHook,
} from './hooks/index.js';
import { loadDailyUsageFromDb } from './model-router.js';
import { onShutdown, runCleanupHooks } from './shutdown.js';
import type { TenantContext } from './tenant-manager.js';
import { tenantManager } from './tenant-manager.js';
import { registerTriggers, setNotificationSender } from './triggers.js';

const globalTasks: ScheduledTask[] = [];
let isShuttingDown = false;

// ── Multi-tenant mode detection ──────────────────────────────────────────────

function isMultiTenantMode(): boolean {
  // Multi-tenant when no AGENT_SLOT is set (new default)
  return !process.env.AGENT_SLOT;
}

// ── Per-tenant startup ───────────────────────────────────────────────────────

async function startTenantServices(ctx: TenantContext): Promise<void> {
  const { slug, schemaName } = ctx;

  console.log(`[hawk] Starting services for tenant '${slug}' (schema: ${schemaName})...`);

  try {
    // Connect Discord for this tenant
    if (ctx.credentials.discordConfig?.bot_token) {
      try {
        await connectDiscordForTenant(ctx);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[hawk] Discord connection failed for '${slug}': ${msg}`);
        console.warn(`[hawk] Tenant '${slug}' running in API-only mode (no Discord).`);
      }
    } else {
      console.warn(`[hawk] Tenant '${slug}' has no Discord config — API-only mode.`);
    }

    // Start per-tenant crons (DB queries scoped via withSchema)
    await withSchema(schemaName, async () => {
      await loadDailyUsageFromDb();
    });

    startTenantCrons(ctx);

    // Wire notification sender for this tenant
    const channelId = getMainChannelId(slug);
    if (channelId) {
      setNotificationSender((msg) => sendToChannel(channelId, msg, slug));
      setAnalyticsNotifier((msg) => sendToChannel(channelId, msg, slug));
    }

    tenantManager.markActive(slug);
    console.log(`[hawk] Tenant '${slug}' started successfully.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    tenantManager.markError(slug, msg);
    console.error(`[hawk] Failed to start tenant '${slug}': ${msg}`);
  }
}

function startTenantCrons(ctx: TenantContext): void {
  const { slug, schemaName } = ctx;

  // Helper: wrap a cron callback in withSchema for DB isolation
  const scoped = <T>(fn: () => Promise<T>): (() => void) => {
    return () => {
      withSchema(schemaName, fn).catch((err) =>
        console.error(`[hawk] Cron error for tenant '${slug}':`, err),
      );
    };
  };

  // Session compactor (hourly)
  const compactorTask = cron.schedule(
    '0 * * * *',
    scoped(() => runSessionCompactor()),
  );
  ctx.cronTasks.push(compactorTask);

  // Weekly: adaptive memory half-lives (Sunday 03:00)
  const adaptiveTask = cron.schedule(
    '0 3 * * 0',
    scoped(() => computeAdaptiveHalfLives()),
  );
  ctx.cronTasks.push(adaptiveTask);

  // Weekly: ML model training (Sunday 03:15)
  const mlTrainTask = cron.schedule(
    '15 3 * * 0',
    scoped(() =>
      Promise.all([learnImportanceWeights(), trainCategorizer(), trainPredictionModels()]),
    ),
  );
  ctx.cronTasks.push(mlTrainTask);

  // Note: The automations below still read CHANNEL_ID from process.env at module level.
  // They work correctly in single-tenant and in multi-tenant for the first tenant.
  // Full per-tenant automation refactor is tracked separately.
  // For now, DB queries are correctly scoped via withSchema in the cron wrappers above.
}

// ── Legacy single-tenant mode ────────────────────────────────────────────────

function validateEnvLegacy() {
  const required = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_AUTHORIZED_USER_ID',
    'OPENROUTER_API_KEY',
    'DATABASE_URL',
  ];
  const warned = ['DISCORD_CHANNEL_GERAL'];

  const missing = required.filter((k) => {
    const val = process.env[k];
    return !val || val === 'not-set' || val.trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const missingWarn = warned.filter((k) => !process.env[k]);
  for (const k of missingWarn) {
    console.warn(`[hawk] Warning: ${k} not set — some features will be disabled`);
  }
}

async function startLegacySingleTenant(): Promise<void> {
  // Legacy path: AGENT_SLOT is set, load credentials into process.env
  await initializeFromAdminDb();
  validateEnvLegacy();
  await loadDailyUsageFromDb();

  // Register built-in hooks
  hookRegistry.register(sessionStartHook);
  hookRegistry.register(sessionEndMemoryHook);
  hookRegistry.register(toolCallWebSocketHook);
  hookRegistry.register(toolLoggerHook);

  const channelId = process.env.DISCORD_CHANNEL_GERAL;
  if (channelId) {
    setNotificationSender((msg) => sendToChannel(channelId, msg));
    setAnalyticsNotifier((msg) => sendToChannel(channelId, msg));
  }
  registerTriggers();

  channelRegistry.register(discordChannel);
  try {
    await channelRegistry.connectAll();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[hawk] Channel connection failed: ${msg}`);
    console.warn('[hawk] Running in API-only mode (no Discord). Check your DISCORD_BOT_TOKEN.');
  }

  startLegacyCrons();
}

function startLegacyCrons(): void {
  startNetWorthSnapshotCron();
  startExtensionSyncCron();
  startBackupCron();
  startMonitorCron();
  startJobMonitorCron();
  startGapScannerCron();
  startCheckinCrons();
  startWeeklyReviewCron();
  startAlertsCron();
  startStreakGuardianCron();
  startMemoryForgetterCron();

  const compactorTask = cron.schedule('0 * * * *', () => {
    runSessionCompactor().catch((err) => console.error('[hawk] Session compactor failed:', err));
  });
  globalTasks.push(compactorTask);

  const adaptiveTask = cron.schedule('0 3 * * 0', () => {
    computeAdaptiveHalfLives().catch((err) =>
      console.error('[hawk] Adaptive half-lives computation failed:', err),
    );
  });
  globalTasks.push(adaptiveTask);

  const mlTrainTask = cron.schedule('15 3 * * 0', () => {
    Promise.all([learnImportanceWeights(), trainCategorizer(), trainPredictionModels()]).catch(
      (err) => console.error('[hawk] ML model training failed:', err),
    );
  });
  globalTasks.push(mlTrainTask);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Validate all env vars at startup — exits with clear error if any required var is missing
  loadConfig();

  // Register event bus subscribers (activity logging, real-time push)
  registerActivitySubscribers();

  // Start alert checker (metrics thresholds → system:alert events)
  startAlertChecker();

  console.log('[hawk] Starting Hawk OS agent...');

  const multiTenant = isMultiTenantMode();

  if (multiTenant) {
    // ── Multi-tenant mode ──────────────────────────────────────
    console.log('[hawk] Multi-tenant mode — loading all active tenants from admin schema...');

    await tenantManager.loadAll();

    if (tenantManager.size === 0) {
      console.warn(
        '[hawk] No tenants found. Agent will wait for tenants via /admin/tenants/:slug/start',
      );
    }

    // Register shared hooks
    hookRegistry.register(sessionStartHook);
    hookRegistry.register(sessionEndMemoryHook);
    hookRegistry.register(toolCallWebSocketHook);
    hookRegistry.register(toolLoggerHook);
    registerTriggers();

    // Start services for each tenant
    for (const ctx of tenantManager.getAll()) {
      await startTenantServices(ctx);
    }

    // Start shared infrastructure crons (not tenant-specific)
    startNetWorthSnapshotCron();
    startExtensionSyncCron();
    startBackupCron();
    startMonitorCron();
    startJobMonitorCron();
    startGapScannerCron();
    startCheckinCrons();
    startWeeklyReviewCron();
    startAlertsCron();
    startStreakGuardianCron();
    startMemoryForgetterCron();

    // Wire demand executor with WebSocket broadcast
    const { broadcast: wsBroadcast } = await import('./api/server.js');
    setDemandBroadcast((type, data) => wsBroadcast(type, data));
    startDemandExecutorCron();
  } else {
    // ── Legacy single-tenant mode (AGENT_SLOT set) ─────────────
    await startLegacySingleTenant();

    const { broadcast: wsBroadcast } = await import('./api/server.js');
    setDemandBroadcast((type, data) => wsBroadcast(type, data));
    startDemandExecutorCron();
  }

  // ── Shared setup (both modes) ──────────────────────────────
  setupContextModules();

  // Initialize ML module centroids (non-blocking)
  initModuleCentroids().catch((err) =>
    console.warn('[hawk] Module centroids init failed (using keyword fallback):', err),
  );

  // Inject Ollama worker LLM for background tasks
  const { getWorkerClient, WORKER_MODEL, isOllamaAvailable } = await import('./llm-client.js');
  const { setWorkerLLM } = await import('@hawk/module-memory/session-commit');
  // biome-ignore lint/suspicious/noExplicitAny: OpenAI type resolution differs between agent and memory packages
  setWorkerLLM(getWorkerClient as any, WORKER_MODEL);
  console.log(
    `[hawk] Worker LLM: ${isOllamaAvailable() ? 'Ollama local' : 'OpenRouter'} (${WORKER_MODEL})`,
  );

  // Run once at startup to initialize all ML models (non-blocking)
  Promise.all([
    computeAdaptiveHalfLives(),
    learnImportanceWeights(),
    trainCategorizer(),
    trainPredictionModels(),
  ]).catch((err) => console.warn('[hawk] ML model initialization failed (non-critical):', err));

  const mode = multiTenant
    ? `multi-tenant (${tenantManager.size} tenants)`
    : 'single-tenant (legacy)';
  console.log(`[hawk] Agent started successfully — ${mode}`);
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[${signal}] Shutting down gracefully...`);

  // Stop global cron tasks
  onShutdown(
    'cron-tasks',
    () => {
      for (const task of globalTasks) task.stop();
      globalTasks.length = 0;
    },
    { priority: 0 },
  );

  // Shutdown all tenants (stops per-tenant crons + Discord clients)
  onShutdown('tenants', () => tenantManager.shutdownAll(), { priority: 5, timeoutMs: 10000 });

  // Legacy channel registry disconnect
  onShutdown('channels', () => channelRegistry.disconnectAll(), { priority: 10, timeoutMs: 5000 });

  onShutdown('api-server', () => stopApiServer(), { priority: 20 });

  await runCleanupHooks();

  console.log('[shutdown] Done. Exiting.');
  process.exit(0);
}

// Force exit safety net
function forceExit() {
  setTimeout(() => {
    console.error('[shutdown] Force exit after 10s timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => {
  forceExit();
  gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  forceExit();
  gracefulShutdown('SIGINT');
});
process.on('uncaughtException', (err) => {
  console.error(`[uncaughtException] ${err}`);
  forceExit();
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error(`[unhandledRejection] ${reason}`);
  forceExit();
  gracefulShutdown('unhandledRejection');
});

main().catch((err) => {
  console.error('[hawk] Failed to start:', err);
  process.exit(1);
});

// Export for use by API server admin endpoints
export { startTenantServices };
