import { db as activityDb } from '@hawk/db';
import { HawkError, createLogger } from '@hawk/shared';
import { resolveAgent } from './agent-resolver.js';
import { addSession, updateSession } from './api/server.js';
import { type PipelineResult, runPipeline } from './middleware/index.js';
import { checkRateLimit, getOrCreateSession, touchWebSession } from './session-manager.js';

const logger = createLogger('handler');

// ── Types ─────────────────────────────────────────────────────────────

export type Attachment = { type: 'image'; url: string };

// ── Conversation persistence (awaited, with proper logging) ──────────

async function persistNewConversation(sessionId: string): Promise<void> {
  const { error } = await activityDb.from('agent_conversations').upsert(
    {
      session_id: sessionId,
      channel: 'discord',
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' },
  );
  if (error) logger.warn({ sessionId, error: error.message }, 'Failed to upsert conversation');
}

async function touchConversation(sessionId: string): Promise<void> {
  const { error } = await activityDb
    .from('agent_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('session_id', sessionId);
  if (error) logger.warn({ sessionId, error: error.message }, 'Failed to touch conversation');
}

async function autoTitleConversation(sessionId: string, userMessage: string): Promise<void> {
  const title = userMessage.length > 50 ? `${userMessage.slice(0, 47)}...` : userMessage;
  const { error } = await activityDb
    .from('agent_conversations')
    .update({ title })
    .eq('session_id', sessionId)
    .is('title', null);
  if (error) logger.warn({ sessionId, error: error.message }, 'Failed to auto-title conversation');
}

// ── Public handlers ───────────────────────────────────────────────────

export async function handleWebMessage(
  sessionId: string,
  userMessage: string,
  onChunk?: (chunk: string) => void,
  tenantApiKey?: string,
  isNewSession = false,
): Promise<PipelineResult> {
  if (!checkRateLimit(`web:${sessionId}`) || !checkRateLimit('web:global')) {
    throw new HawkError(
      'Rate limit exceeded. Aguarde um momento antes de enviar mais mensagens.',
      'RATE_LIMITED',
    );
  }
  touchWebSession(sessionId);
  const agent = await resolveAgent(sessionId, 'web');
  const result = await runPipeline({
    sessionId,
    userMessage,
    channel: 'web',
    agent,
    isNewSession,
    onChunk,
    tenantApiKey,
  });
  touchWebSession(sessionId);
  return result;
}

export async function handleMessage(
  userMessage: string,
  channelId?: string,
  attachments?: Attachment[],
): Promise<string> {
  return _handleDiscord({ userMessage, channelId, attachments });
}

/**
 * Handle a Discord message with streaming support.
 */
export async function handleStreamingMessage(
  userMessage: string,
  channelId?: string,
  onChunk?: (chunk: string) => void,
  attachments?: Attachment[],
): Promise<string> {
  return _handleDiscord({ userMessage, channelId, onChunk, attachments });
}

/**
 * Handle a message from an automation (heartbeat, cron, etc).
 */
export async function handleAutomationMessage(prompt: string): Promise<string> {
  const sessionId = `automation-${Date.now()}`;
  const agent = await resolveAgent(sessionId, 'discord');
  const result = await runPipeline({
    sessionId,
    userMessage: prompt,
    channel: 'discord',
    agent,
    isNewSession: true,
  });
  return result.response;
}

// ── Internal: shared Discord handler ─────────────────────────────────

async function _handleDiscord(opts: {
  userMessage: string;
  channelId?: string;
  onChunk?: (chunk: string) => void;
  attachments?: Attachment[];
}): Promise<string> {
  const channel = opts.channelId ?? 'default';
  if (!checkRateLimit(`discord:${channel}`)) {
    return 'Rate limit: aguarde um momento antes de enviar mais mensagens.';
  }
  const { sessionId, isNew } = getOrCreateSession(channel);

  if (isNew) {
    addSession(sessionId, channel);
    await persistNewConversation(sessionId);
  } else {
    updateSession(sessionId);
    await touchConversation(sessionId);
  }

  const agent = await resolveAgent(sessionId, 'discord');
  const result = await runPipeline({
    sessionId,
    userMessage: opts.userMessage,
    channel: 'discord',
    agent,
    isNewSession: isNew,
    onChunk: opts.onChunk,
    attachments: opts.attachments,
  });

  if (isNew) {
    await autoTitleConversation(sessionId, opts.userMessage);
  }

  return result.response;
}
