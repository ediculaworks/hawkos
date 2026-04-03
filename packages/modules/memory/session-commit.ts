import { db } from '@hawk/db';
import { HawkError, createLogger } from '@hawk/shared';
import type OpenAI from 'openai';
import { applyDedupResult, deduplicateMemory } from './deduplicator';
import type { MemoryCandidate } from './deduplicator';
import { predictImportance } from './importance-scorer';
import { extractMemoriesByRules } from './rule-extractor';

const logger = createLogger('memory');

// Worker client + model injected from agent (Ollama local or OpenRouter)
let _workerClient: (() => OpenAI) | null = null;
let _workerModel = process.env.MEMORY_WORKER_MODEL ?? 'nvidia/nemotron-nano-9b-v2:free';

export function setWorkerLLM(clientFn: () => OpenAI, model: string): void {
  _workerClient = clientFn;
  _workerModel = model;
}

function getClient(): OpenAI {
  if (_workerClient) return _workerClient();
  // Fallback: lazy OpenRouter client
  const OpenAIModule = require('openai') as {
    default: new (opts: Record<string, unknown>) => OpenAI;
  };
  const client = new OpenAIModule.default({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || 'not-set',
  });
  return client;
}

function getModel(): string {
  return _workerModel;
}

// ── Types ──────────────────────────────────────────────────

type SessionMessage = {
  role: string;
  content: string;
  created_at: string;
};

type CommitResult = {
  sessionId: string;
  archived: boolean;
  memoriesExtracted: number;
  memoriesCreated: number;
  memoriesMerged: number;
  memoriesSkipped: number;
};

// ── Session Commit Flow ────────────────────────────────────

/**
 * Find sessions that have expired (no new messages in the last `ttlMs` milliseconds)
 * and haven't been archived yet.
 */
export async function findExpiredSessions(ttlMs = 30 * 60 * 1000): Promise<string[]> {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();

  // Find sessions with messages, where the latest message is older than cutoff,
  // and the session hasn't been archived yet
  const { data, error } = await db
    .from('conversation_messages')
    .select('session_id')
    .eq('archived', false)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to find expired sessions');
    throw new HawkError(`Failed to find expired sessions: ${error.message}`, 'DB_QUERY_FAILED');
  }

  // Deduplicate session IDs
  const sessionIds = new Set<string>((data ?? []).map((m: any) => m.session_id as string));

  // Filter out sessions that already have archives (batch query instead of N+1)
  const sessionIdArray = Array.from(sessionIds);
  if (sessionIdArray.length === 0) return [];

  const { data: existingArchives } = await db
    .from('session_archives')
    .select('session_id')
    .in('session_id', sessionIdArray);

  const archivedIds = new Set((existingArchives ?? []).map((a: any) => a.session_id as string));
  return sessionIdArray.filter((id) => !archivedIds.has(id));
}

/**
 * Commit a session: archive messages, extract memories, deduplicate, persist.
 *
 * OpenViking-inspired flow:
 * 1. Load all messages for the session
 * 2. Generate abstract (L0) and overview (L1) via LLM
 * 3. Extract memory candidates via LLM
 * 4. Deduplicate each candidate (vector + LLM)
 * 5. Persist results and mark messages as archived
 */
export async function commitSession(sessionId: string): Promise<CommitResult> {
  // 1. Load session messages
  const { data: messages, error } = await db
    .from('conversation_messages')
    .select('role, content, channel, created_at')
    .eq('session_id', sessionId)
    .eq('archived', false)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error({ error: error.message, sessionId }, 'Failed to load session messages');
    throw new HawkError(`Failed to load session messages: ${error.message}`, 'DB_QUERY_FAILED');
  }
  if (!messages?.length) {
    // Archive empty sessions to prevent infinite reprocessing
    await db.from('session_archives').insert({
      session_id: sessionId,
      channel: 'unknown',
      message_count: 0,
      abstract: 'Sessão vazia — sem mensagens.',
      overview: '',
      messages: [],
      memories_extracted: 0,
    });
    return {
      sessionId,
      archived: true,
      memoriesExtracted: 0,
      memoriesCreated: 0,
      memoriesMerged: 0,
      memoriesSkipped: 0,
    };
  }

  const typedMessages = messages as SessionMessage[];

  // 2. Generate archive (abstract + overview)
  const transcript = formatTranscript(typedMessages);
  const { abstract, overview } = await generateArchiveSummary(transcript);

  // 3. Extract memory candidates (hybrid: rules first, LLM fallback)
  const { candidates: ruleCandidates, needsLlmFallback } = extractMemoriesByRules(transcript);

  // Use learned importance scoring for rule-extracted candidates
  for (const candidate of ruleCandidates) {
    candidate.importance = predictImportance(
      candidate.content,
      candidate.memory_type,
      candidate.module,
    );
  }

  // Only call LLM if rules didn't find enough (saves ~60% of LLM extraction calls)
  let llmCandidates: MemoryCandidate[] = [];
  if (needsLlmFallback) {
    llmCandidates = await extractMemories(transcript);
    // Apply learned importance to LLM candidates too
    for (const candidate of llmCandidates) {
      candidate.importance = predictImportance(
        candidate.content,
        candidate.memory_type,
        candidate.module,
      );
    }
  }

  // Merge: rules first, then LLM additions (dedup will handle overlaps)
  const candidates = [...ruleCandidates, ...llmCandidates];

  // 4. Deduplicate and persist memories (batched for performance)
  let created = 0;
  let merged = 0;
  let skipped = 0;

  const DEDUP_BATCH_SIZE = 5;
  for (let i = 0; i < candidates.length; i += DEDUP_BATCH_SIZE) {
    const batch = candidates.slice(i, i + DEDUP_BATCH_SIZE);
    const dedupResults = await Promise.all(batch.map((c) => deduplicateMemory(c)));

    for (let j = 0; j < batch.length; j++) {
      const candidate = batch[j];
      const dedupResult = dedupResults[j];
      if (!candidate || !dedupResult) continue;

      const memoryId = await applyDedupResult(candidate, dedupResult, sessionId);

      if (dedupResult.decision === 'CREATE' && memoryId) {
        created++;
        generateMemoryLayers(
          memoryId,
          candidate.content,
          candidate.memory_type,
          candidate.module,
        ).catch(() => {});
      } else if (dedupResult.decision === 'MERGE' && memoryId) {
        merged++;
        const mergedContent = dedupResult.mergedContent ?? candidate.content;
        generateMemoryLayers(
          memoryId,
          mergedContent,
          candidate.memory_type,
          candidate.module,
        ).catch(() => {});
      } else {
        skipped++;
      }
    }
  }

  // 5. Save session archive + mark messages as archived
  // Extract channel from messages metadata instead of hardcoding
  const channel = ((messages[0] as Record<string, unknown>)?.channel as string) ?? 'unknown';

  // Insert archive — if session was already archived (race condition), skip gracefully
  const { error: archiveError } = await db.from('session_archives').insert({
    session_id: sessionId,
    channel,
    message_count: typedMessages.length,
    abstract,
    overview,
    messages: typedMessages,
    memories_extracted: candidates.length,
  });

  if (archiveError) {
    // Likely duplicate — another compactor instance already archived this session
    if (archiveError.code === '23505') {
      return {
        sessionId,
        archived: true,
        memoriesExtracted: 0,
        memoriesCreated: created,
        memoriesMerged: merged,
        memoriesSkipped: skipped,
      };
    }
    logger.error({ error: archiveError.message, sessionId }, 'Failed to archive session');
    throw new HawkError(`Failed to archive session: ${archiveError.message}`, 'DB_INSERT_FAILED');
  }

  // 6. Mark messages as archived (only after successful archive insert)
  await db.from('conversation_messages').update({ archived: true }).eq('session_id', sessionId);

  // 7. Log activity
  await db.from('activity_log').insert({
    event_type: 'session_committed',
    summary: `Sessão arquivada: ${typedMessages.length} mensagens, ${created} memórias criadas, ${merged} merges, ${skipped} duplicatas ignoradas`,
    metadata: {
      session_id: sessionId,
      message_count: typedMessages.length,
      memories_created: created,
      memories_merged: merged,
      memories_skipped: skipped,
    },
  });

  return {
    sessionId,
    archived: true,
    memoriesExtracted: candidates.length,
    memoriesCreated: created,
    memoriesMerged: merged,
    memoriesSkipped: skipped,
  };
}

// ── Internal helpers ───────────────────────────────────────

function formatTranscript(messages: SessionMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Hawk' : 'Sistema';
      return `[${role}]: ${m.content}`;
    })
    .join('\n\n');
}

async function generateArchiveSummary(
  transcript: string,
): Promise<{ abstract: string; overview: string }> {
  const response = await getClient().chat.completions.create({
    model: getModel(),
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content: `Você é um sistema de compactação de sessões. Gere dois resumos de uma conversa:

1. "abstract": Um resumo ultra-conciso (~100 tokens) capturando o tema principal e resultado da conversa. Serve para busca rápida.
2. "overview": Um resumo detalhado (~500 tokens) com os pontos principais, decisões tomadas, ações realizadas, e contexto relevante.

Responda em JSON: {"abstract": "...", "overview": "..."}
Escreva em português.`,
      },
      {
        role: 'user',
        content: `Transcrição da sessão:\n\n${transcript}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    return {
      abstract: 'Sessão sem resumo disponível.',
      overview: 'Não foi possível gerar overview para esta sessão.',
    };
  }

  try {
    const parsed = JSON.parse(content) as { abstract: string; overview: string };
    return {
      abstract: parsed.abstract || 'Sessão sem resumo disponível.',
      overview: parsed.overview || 'Não foi possível gerar overview para esta sessão.',
    };
  } catch {
    return {
      abstract: 'Sessão sem resumo disponível.',
      overview: 'Não foi possível gerar overview para esta sessão.',
    };
  }
}

async function extractMemories(transcript: string): Promise<MemoryCandidate[]> {
  const response = await getClient().chat.completions.create({
    model: getModel(),
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content: `Você é um sistema de extração de memórias de longo prazo. Analise a conversa e extraia fatos, preferências, e aprendizados que devem ser lembrados em futuras conversas.

Categorize cada memória em um dos 6 tipos:
- "profile": Atributos de identidade do usuário (nome, idade, profissão, condições médicas)
- "preference": Preferências por tópico (comida favorita, horário preferido, estilo de comunicação)
- "entity": Pessoas, projetos, ou locais mencionados com contexto (quem são, relação)
- "event": Decisões, marcos, ou acontecimentos importantes (começou medicação, mudou de emprego)
- "case": Correções ou aprendizados sobre como o assistente deve agir (quando errou e como deveria ter feito)
- "pattern": Processos ou padrões reutilizáveis (como o usuário prefere registrar gastos)

Para cada memória, indique:
- "content": O conteúdo da memória em uma frase clara e concisa
- "memory_type": Um dos 6 tipos acima
- "module": O módulo do sistema mais relevante (finances, health, people, career, objectives, knowledge, routine, assets, entertainment, legal, social, spirituality, housing, security, calendar, journal) ou null
- "importance": De 1 a 10 (10 = crítico para interações futuras)

Responda em JSON: {"memories": [...]}
Extraia apenas memórias genuinamente úteis para o futuro. Não repita informações óbvias ou triviais.
Se não houver memórias úteis, retorne {"memories": []}.`,
      },
      {
        role: 'user',
        content: `Transcrição:\n\n${transcript}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { memories: MemoryCandidate[] };
    return (parsed.memories ?? []).filter(
      (m) =>
        m.content &&
        m.memory_type &&
        ['profile', 'preference', 'entity', 'event', 'case', 'pattern'].includes(m.memory_type),
    );
  } catch {
    return [];
  }
}

/**
 * Generate L0 (abstract) and L1 (overview) layers for a memory.
 * Updates the memory in-place with path, l0_abstract, l1_overview.
 */
async function generateMemoryLayers(
  memoryId: string,
  content: string,
  memoryType: string,
  module: string | null,
): Promise<void> {
  const response = await getClient().chat.completions.create({
    model: getModel(),
    max_tokens: 512,
    messages: [
      {
        role: 'system',
        content: `Generate two summaries for a "${memoryType}" memory:

1. "l0": A concise ~15-word abstract optimized for embedding search. Single sentence.
2. "l1": A 2-paragraph overview: (a) key facts and context, (b) when/how this memory is useful.

Respond in JSON: {"l0": "...", "l1": "..."}
Write in Portuguese.`,
      },
      {
        role: 'user',
        content,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) return;

  let parsed: { l0: string; l1: string };
  try {
    parsed = JSON.parse(raw) as { l0: string; l1: string };
  } catch {
    return;
  }

  const path = `${memoryType}/${module ?? 'general'}`;

  await db
    .from('agent_memories')
    .update({
      path,
      l0_abstract: parsed.l0 || null,
      l1_overview: parsed.l1 || null,
    })
    .eq('id', memoryId);
}

/**
 * Get the most recent session archive for a given channel.
 * Used for session continuity — loading previous context when starting a new session.
 */
export async function getLastSessionArchive(
  channel: string,
): Promise<{ abstract: string; overview: string } | null> {
  const { data, error } = await db
    .from('session_archives')
    .select('abstract, overview')
    .eq('channel', channel)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as { abstract: string; overview: string };
}
