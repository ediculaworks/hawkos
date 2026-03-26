import { initModuleCentroids } from '@hawk/context-engine';
import { trainCategorizer } from '@hawk/module-finances/categorizer';
import { trainPredictionModels } from '@hawk/module-health/predictor';
import { computeAdaptiveHalfLives, learnImportanceWeights } from '@hawk/module-memory';
import cron, { type ScheduledTask } from 'node-cron';
import { stopApiServer } from './api/server.js';
import { setAnalyticsNotifier } from './automations/analytics.js';
import { startBackupCron } from './automations/backup.js';
import { setDemandBroadcast, startDemandExecutorCron } from './automations/demand-executor.js';
import { startExtensionSyncCron } from './automations/extension-sync.js';
import { startGapScannerCron } from './automations/gap-scanner.js';
import { startJobMonitorCron } from './automations/job-monitor.js';
import { startMonitorCron } from './automations/monitor.js';
import { startNetWorthSnapshotCron } from './automations/net-worth-snapshot.js';
import { runSessionCompactor } from './automations/session-compactor.js';
import { discordChannel } from './channels/discord-adapter.js';
import { sendToChannel } from './channels/discord.js';
import { channelRegistry } from './channels/registry.js';
import { setupContextModules } from './context-setup.js';
import { initializeFromAdminSupabase } from './credential-manager.js';
import {
  hookRegistry,
  sessionEndMemoryHook,
  sessionStartHook,
  toolCallWebSocketHook,
  toolLoggerHook,
} from './hooks/index.js';
import { registerTriggers, setNotificationSender } from './triggers.js';

const activeTasks: ScheduledTask[] = [];
let isShuttingDown = false;

function validateEnv() {
  const required = ['DISCORD_BOT_TOKEN', 'DISCORD_AUTHORIZED_USER_ID', 'OPENROUTER_API_KEY'];
  const warned = ['DISCORD_CHANNEL_GERAL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const missingWarn = warned.filter((k) => !process.env[k]);
  for (const k of missingWarn) {
    console.warn(`[hawk] Warning: ${k} not set — some features will be disabled`);
  }
}

async function main() {
  console.log('[hawk] Starting Hawk OS agent...');

  // Load tenant credentials from Admin Supabase if AGENT_SLOT is set
  await initializeFromAdminSupabase();

  validateEnv();
  setupContextModules();

  // Register built-in hooks
  hookRegistry.register(sessionStartHook);
  hookRegistry.register(sessionEndMemoryHook);
  hookRegistry.register(toolCallWebSocketHook);
  hookRegistry.register(toolLoggerHook);
  // Register event bus triggers + notification sender
  const channelId = process.env.DISCORD_CHANNEL_GERAL;
  if (channelId) {
    setNotificationSender((msg) => sendToChannel(channelId, msg));
    setAnalyticsNotifier((msg) => sendToChannel(channelId, msg));
  }
  registerTriggers();

  // Initialize ML module centroids (embedding-based module detection)
  // Non-blocking: agent works with keyword fallback while centroids load
  initModuleCentroids().catch((err) =>
    console.warn('[hawk] Module centroids init failed (using keyword fallback):', err),
  );

  channelRegistry.register(discordChannel);
  try {
    await channelRegistry.connectAll();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[hawk] Channel connection failed: ${msg}`);
    console.warn('[hawk] Running in API-only mode (no Discord). Check your DISCORD_BOT_TOKEN.');
  }
  // ── Inject Ollama worker LLM for background tasks ────────────────
  const { getWorkerClient, WORKER_MODEL, isOllamaAvailable } = await import('./llm-client.js');
  const { setWorkerLLM } = await import('@hawk/module-memory/session-commit');
  // biome-ignore lint/suspicious/noExplicitAny: OpenAI type resolution differs between agent and memory packages
  setWorkerLLM(getWorkerClient as any, WORKER_MODEL);
  console.log(
    `[hawk] Worker LLM: ${isOllamaAvailable() ? 'Ollama local' : 'OpenRouter'} (${WORKER_MODEL})`,
  );

  // ── Active crons (no LLM calls) ──────────────────────────────────
  startNetWorthSnapshotCron();
  startExtensionSyncCron();
  startBackupCron();
  startMonitorCron();
  startJobMonitorCron();

  // Wire demand executor with WebSocket broadcast
  const { broadcast: wsBroadcast } = await import('./api/server.js');
  setDemandBroadcast((type, data) => wsBroadcast(type, data));
  startDemandExecutorCron();

  // ── Background LLM crons (use Ollama local, no OpenRouter tokens) ──
  startGapScannerCron();
  const compactorTask = cron.schedule('0 * * * *', () => {
    runSessionCompactor().catch((err) => console.error('[hawk] Session compactor failed:', err));
  });
  activeTasks.push(compactorTask);

  // ── Still disabled (send Discord messages via handler = OpenRouter) ──
  // Enable these only when token budget allows:
  // startHealthInsightsCron();
  // startContentPipelineCron();
  // startStreakGuardianCron();
  // startAlertsCron();
  // startCheckinCrons();
  // startWeeklyReviewCron();
  // startHeartbeatCron();

  // Weekly: recompute adaptive memory half-lives from access patterns
  // Runs Sunday at 03:00 (low traffic) — the system learns optimal decay rates
  const adaptiveTask = cron.schedule('0 3 * * 0', () => {
    computeAdaptiveHalfLives().catch((err) =>
      console.error('[hawk] Adaptive half-lives computation failed:', err),
    );
  });
  activeTasks.push(adaptiveTask);

  // Weekly: retrain ML models (Sunday 03:15 — after adaptive half-lives)
  const mlTrainTask = cron.schedule('15 3 * * 0', () => {
    Promise.all([learnImportanceWeights(), trainCategorizer(), trainPredictionModels()]).catch(
      (err) => console.error('[hawk] ML model training failed:', err),
    );
  });
  activeTasks.push(mlTrainTask);

  // Run once at startup to initialize all ML models from existing data (non-blocking)
  Promise.all([
    computeAdaptiveHalfLives(),
    learnImportanceWeights(),
    trainCategorizer(),
    trainPredictionModels(),
  ]).catch(() => {});

  console.log('[hawk] Agent started successfully.');
}

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[${signal}] Shutting down gracefully...`);

  // 1. Stop cron tasks
  for (const task of activeTasks) {
    task.stop();
  }
  activeTasks.length = 0;
  console.log('[shutdown] Cron tasks stopped.');

  // 2. Disconnect channels (with 5s timeout)
  try {
    await Promise.race([
      channelRegistry.disconnectAll(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Channel disconnect timeout')), 5000),
      ),
    ]);
    console.log('[shutdown] All channels disconnected.');
  } catch {
    console.error('[shutdown] Channel disconnect timed out after 5s.');
  }

  // 3. Stop API server
  stopApiServer();
  console.log('[shutdown] API server stopped.');

  console.log('[shutdown] Done. Exiting.');
  process.exit(0);
}

// Force exit safety net — prevent zombie process
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
});

main().catch((err) => {
  console.error('[hawk] Failed to start:', err);
  process.exit(1);
});
