import { readFileSync, watchFile } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cron, { type ScheduledTask } from 'node-cron';
import { hookRegistry } from '../hooks/index.js';
import { WORKER_MODEL, getWorkerClient } from '../llm-client.js';

const HEARTBEAT_SYSTEM_PROMPT =
  'Você é um monitor de sistema pessoal. Analise o checklist fornecido. Se tudo estiver em ordem, responda apenas: HEARTBEAT_OK. Caso contrário, liste os pontos de atenção de forma concisa (máximo 5 linhas). Responda em português do Brasil.';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_PATH = join(__dirname, '../../../workspace/HEARTBEAT.md');

// ── Proactivity Profiles ──────────────────────────────────────

export type ProactivityProfile = 'guardian' | 'companion' | 'silent';

const PROFILE_SCHEDULES: Record<ProactivityProfile, string | null> = {
  guardian: '*/30 7-23 * * *', // every 30min, 7am-11pm
  companion: '0 9,13,18,21 * * *', // 4x/day: morning, lunch, evening, night
  silent: null, // disabled
};

const PROFILE_DESCRIPTIONS: Record<ProactivityProfile, string> = {
  guardian: 'every 30min, 7am-11pm — checks everything, alerts on anything detected',
  companion: '4x/day (9h, 13h, 18h, 21h) — shows up with relevant context, conversational',
  silent: 'disabled — only scheduled cron automations, zero heartbeat',
};

function getActiveProfile(): ProactivityProfile {
  const env = process.env.HEARTBEAT_PROFILE?.toLowerCase();
  if (env === 'guardian' || env === 'companion' || env === 'silent') return env;
  return 'companion'; // default
}

function getActiveHours(): { start: number; end: number } {
  const raw = process.env.HEARTBEAT_ACTIVE_HOURS; // format: "08:00-22:00"
  if (raw) {
    const match = raw.match(/^(\d{1,2}):?\d{0,2}-(\d{1,2}):?\d{0,2}$/);
    if (match) {
      return {
        start: Number.parseInt(match[1] as string),
        end: Number.parseInt(match[2] as string),
      };
    }
  }
  return { start: 8, end: 22 };
}

// ── Checklist Loading (with hot reload) ────────────────────────

let heartbeatChecklist: string | null = null;

function loadHeartbeatChecklist(): string {
  if (heartbeatChecklist) return heartbeatChecklist;
  try {
    heartbeatChecklist = readFileSync(HEARTBEAT_PATH, 'utf-8');
    return heartbeatChecklist;
  } catch {
    return '# Heartbeat\nNo checklist found.';
  }
}

// Watch for changes to HEARTBEAT.md (hot reload without restart)
try {
  watchFile(HEARTBEAT_PATH, { interval: 5000 }, () => {
    heartbeatChecklist = null; // force reload on next run
    console.log('[heartbeat] HEARTBEAT.md changed, will reload on next beat');
  });
} catch {
  // file might not exist yet
}

// ── Core Heartbeat Logic ──────────────────────────────────────

function isWithinActiveHours(): boolean {
  const { start, end } = getActiveHours();
  const now = new Date();
  const hour = now.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = Number.parseInt(hour);
  return currentHour >= start && currentHour < end;
}

/**
 * Run the heartbeat: load checklist, send to agent, handle response.
 * The agent processes the checklist and responds with alerts or HEARTBEAT_OK.
 */
export async function runHeartbeat(): Promise<string | null> {
  if (!isWithinActiveHours()) {
    console.log('[heartbeat] Outside active hours, skipping');
    return null;
  }

  const profile = getActiveProfile();
  const checklist = loadHeartbeatChecklist();
  const now = new Date();
  const brtTime = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hour = Number.parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }),
  );
  const dayOfWeek = now.getDay(); // 0=Sun
  const dayOfMonth = now.getDate();

  // Build context hints for the agent
  const hints: string[] = [];
  if (hour >= 8 && hour <= 10) hints.push('Horário de verificação diária.');
  if (dayOfWeek === 1) hints.push('Segunda-feira — verificar itens semanais.');
  if (dayOfMonth === 1) hints.push('Primeiro do mês — verificar itens mensais.');

  // Profile-specific instructions
  const profileInstructions: Record<ProactivityProfile, string> = {
    guardian:
      'Modo GUARDIÃO ativo. Verifique TODOS os itens do checklist. Reporte qualquer item que precise de atenção, mesmo que não seja urgente. Seja detalhado.',
    companion:
      'Modo COMPANHEIRO ativo. Seja conversacional e natural. Só reporte o que for realmente relevante ou interessante. Se não há nada importante, responda HEARTBEAT_OK. Priorize: 1) urgências, 2) padrões interessantes, 3) lembretes gentis.',
    silent: '', // should never reach here
  };

  const prompt = [
    checklist,
    '',
    `**Contexto:** ${brtTime}`,
    hints.length > 0 ? hints.join(' ') : '',
    '',
    profileInstructions[profile],
    '',
    'Se não há nada para reportar, responda apenas: HEARTBEAT_OK',
  ]
    .filter(Boolean)
    .join('\n');

  await hookRegistry.emit('automation:before', { automationName: 'heartbeat' }).catch(() => {});

  try {
    const completion = await getWorkerClient().chat.completions.create({
      model: WORKER_MODEL,
      messages: [
        { role: 'system', content: HEARTBEAT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      stream: false,
    });

    const response = completion.choices[0]?.message?.content ?? null;

    await hookRegistry.emit('automation:after', { automationName: 'heartbeat' }).catch(() => {});

    if (!response || response.includes('HEARTBEAT_OK')) {
      console.log(`[heartbeat] All clear (${profile} mode)`);
      return null;
    }

    return response;
  } catch (err) {
    console.error('[heartbeat] Failed to run heartbeat:', err);
    return null;
  }
}

/**
 * Start the heartbeat cron job based on active profile.
 * Profile is read from HEARTBEAT_PROFILE env var (default: companion).
 * Active hours from HEARTBEAT_ACTIVE_HOURS env var (default: 08:00-22:00).
 */
export function startHeartbeatCron(): ScheduledTask | null {
  const profile = getActiveProfile();
  const schedule = PROFILE_SCHEDULES[profile];

  if (!schedule) {
    console.log(`[hawk] Heartbeat disabled (profile: ${profile})`);
    return null;
  }

  const task = cron.schedule(
    schedule,
    () => {
      runHeartbeat()
        .then((report) => {
          if (report) {
            console.log('[heartbeat] Report:', report.slice(0, 200));
            import('../channels/discord-adapter.js').then(({ discordChannel }) => {
              const channelId = process.env.DISCORD_CHANNEL_GERAL;
              if (channelId && discordChannel.isConnected()) {
                discordChannel.send(channelId, report).catch(console.error);
              }
            });
          }
        })
        .catch((err) => console.error('[heartbeat] Error:', err));
    },
    { timezone: 'America/Sao_Paulo' },
  );

  console.log(`[hawk] Heartbeat started — profile: ${profile} (${PROFILE_DESCRIPTIONS[profile]})`);
  return task;
}
