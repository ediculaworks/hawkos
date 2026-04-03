import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';
import type {
  AgentMemory,
  ConversationMessage,
  ConversationSummary,
  CreateMemoryInput,
  MemoryFilters,
  MemoryGraph,
  MemoryGraphEdge,
  MemoryGraphNode,
  SaveMessageInput,
  SessionArchive,
  UpdateMemoryInput,
} from './types.js';

const logger = createLogger('memory');

const CreateMemorySchema = z.object({ content: z.string().min(1), category: z.string().min(1) });

// ── Memories CRUD ──────────────────────────────────────────

export async function createMemory(input: CreateMemoryInput): Promise<AgentMemory> {
  const parsed = CreateMemorySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  const { data, error } = await db
    .from('agent_memories')
    .insert({
      category: input.category,
      content: input.content,
      module: input.module ?? null,
      related_modules: input.related_modules ?? [],
      source_message_id: input.source_message_id ?? null,
      importance: input.importance ?? 5,
      confidence: input.confidence ?? 1.0,
      status: input.status ?? 'active',
      tags: input.tags ?? [],
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create memory');
    throw new HawkError(`Failed to create memory: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as unknown as AgentMemory;
}

export async function listMemories(filters: MemoryFilters = {}): Promise<AgentMemory[]> {
  let query = db
    .from('agent_memories')
    .select(
      'id, category, memory_type, content, module, related_modules, source_message_id, importance, confidence, status, last_accessed, access_count, expires_at, tags, mergeable, origin_session_id, path, l0_abstract, l1_overview, created_at, updated_at',
    )
    .order(filters.sort ?? 'created_at', { ascending: false });

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.memory_type) query = query.eq('memory_type', filters.memory_type);
  if (filters.module) query = query.eq('module', filters.module);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.minImportance) query = query.gte('importance', filters.minImportance);

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list memories');
    throw new HawkError(`Failed to list memories: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as AgentMemory[];
}

export async function searchMemories(searchQuery: string, limit = 20): Promise<AgentMemory[]> {
  const { data, error } = await db
    .from('agent_memories')
    .select(
      'id, category, memory_type, content, module, related_modules, source_message_id, importance, confidence, status, last_accessed, access_count, expires_at, tags, mergeable, origin_session_id, path, l0_abstract, l1_overview, created_at, updated_at',
    )
    .textSearch('search_vector', searchQuery, { type: 'websearch', config: 'portuguese' })
    .eq('status', 'active')
    .order('importance', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search memories');
    throw new HawkError(`Failed to search memories: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as AgentMemory[];
}

export async function updateMemory(id: string, input: UpdateMemoryInput): Promise<AgentMemory> {
  const updates: Record<string, unknown> = {};
  if (input.content !== undefined) updates.content = input.content;
  if (input.category !== undefined) updates.category = input.category;
  if (input.module !== undefined) updates.module = input.module;
  if (input.related_modules !== undefined) updates.related_modules = input.related_modules;
  if (input.importance !== undefined) updates.importance = input.importance;
  if (input.confidence !== undefined) updates.confidence = input.confidence;
  if (input.status !== undefined) updates.status = input.status;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.expires_at !== undefined) updates.expires_at = input.expires_at;

  const { data, error } = await db
    .from('agent_memories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update memory');
    throw new HawkError(`Failed to update memory: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as unknown as AgentMemory;
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await db.from('agent_memories').update({ status: 'archived' }).eq('id', id);

  if (error) {
    logger.error({ error: error.message }, 'Failed to archive memory');
    throw new HawkError(`Failed to archive memory: ${error.message}`, 'DB_UPDATE_FAILED');
  }
}

/**
 * Archive memories that have passed their expires_at date.
 * Called by the session compactor on each run.
 */
export async function archiveExpiredMemories(): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('agent_memories')
    .update({ status: 'archived' })
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .select('id');

  if (error) {
    return 0;
  }
  return data?.length ?? 0;
}

export async function getTopMemories(limit = 10, module?: string): Promise<AgentMemory[]> {
  let query = db
    .from('agent_memories')
    .select(
      'id, category, memory_type, content, module, related_modules, source_message_id, importance, confidence, status, last_accessed, access_count, expires_at, tags, mergeable, origin_session_id, path, l0_abstract, l1_overview, created_at, updated_at',
    )
    .eq('status', 'active')
    .order('importance', { ascending: false })
    .order('last_accessed', { ascending: false })
    .limit(limit);

  if (module) query = query.or(`module.eq.${module},related_modules.cs.{${module}}`);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to get top memories');
    throw new HawkError(`Failed to get top memories: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as AgentMemory[];
}

export async function getMemoryStats(): Promise<{
  total: number;
  by_category: Record<string, number>;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_module: Record<string, number>;
  pending_count: number;
  this_week: number;
  avg_importance: number;
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: total },
    { data: catTypeData },
    { data: statusData },
    { count: pendingCount },
    { count: thisWeekCount },
    { data: importanceData },
  ] = await Promise.all([
    db.from('agent_memories').select('id', { count: 'exact', head: true }),
    db.from('agent_memories').select('category, memory_type, module').limit(10000),
    db.from('agent_memories').select('status').limit(10000),
    db.from('agent_memories').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db
      .from('agent_memories')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo),
    db.from('agent_memories').select('importance').eq('status', 'active').limit(10000),
  ]);

  const by_category: Record<string, number> = {};
  const by_type: Record<string, number> = {};
  const by_module: Record<string, number> = {};
  for (const m of catTypeData ?? []) {
    const cat = (m.category as string) ?? 'unknown';
    by_category[cat] = (by_category[cat] ?? 0) + 1;
    const mt = (m.memory_type as string) ?? 'unknown';
    by_type[mt] = (by_type[mt] ?? 0) + 1;
    const mod = m.module as string;
    if (mod) by_module[mod] = (by_module[mod] ?? 0) + 1;
  }

  const by_status: Record<string, number> = {};
  for (const m of statusData ?? []) {
    const status = (m.status as string) ?? 'unknown';
    by_status[status] = (by_status[status] ?? 0) + 1;
  }

  const importances = (importanceData ?? []).map((m: any) => (m.importance as number) ?? 5);
  const avg_importance =
    importances.length > 0
      ? Math.round((importances.reduce((a: any, b: any) => a + b, 0) / importances.length) * 10) /
        10
      : 5;

  return {
    total: total ?? 0,
    by_category,
    by_type,
    by_status,
    by_module,
    pending_count: pendingCount ?? 0,
    this_week: thisWeekCount ?? 0,
    avg_importance,
  };
}

// ── Memory Graph ───────────────────────────────────────────

export async function getMemoryGraph(): Promise<MemoryGraph> {
  const { data, error } = await db
    .from('agent_memories')
    .select(
      'id, category, memory_type, content, module, related_modules, importance, access_count, status',
    )
    .in('status', ['active', 'pending'])
    .order('importance', { ascending: false })
    .limit(200);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get memory graph');
    throw new HawkError(`Failed to get memory graph: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const memories = (data ?? []) as MemoryGraphNode[];
  const edges: MemoryGraphEdge[] = [];

  // Build edges from shared modules using module-indexed lookup (O(n) instead of O(n²))
  const moduleIndex = new Map<string, string[]>(); // module → memory IDs
  for (const mem of memories) {
    const modules = [...(mem.module ? [mem.module] : []), ...mem.related_modules];
    for (const mod of modules) {
      const existing = moduleIndex.get(mod);
      if (existing) {
        existing.push(mem.id);
      } else {
        moduleIndex.set(mod, [mem.id]);
      }
    }
  }

  // For each module group, create edges between members (cap edges per group to prevent blowup)
  const MAX_EDGES_PER_MODULE = 50;
  const edgeSet = new Set<string>();
  for (const [mod, ids] of moduleIndex) {
    const limit = Math.min(ids.length, MAX_EDGES_PER_MODULE);
    for (let i = 0; i < limit; i++) {
      for (let j = i + 1; j < limit; j++) {
        const key = `${ids[i]}:${ids[j]}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: ids[i] as string, target: ids[j] as string, shared_module: mod });
        }
      }
    }
  }

  return { nodes: memories, edges };
}

// ── Conversation Messages ──────────────────────────────────

export async function saveMessage(input: SaveMessageInput): Promise<ConversationMessage> {
  const { data, error } = await db
    .from('conversation_messages')
    .insert({
      session_id: input.session_id,
      role: input.role,
      content: input.content,
      channel: input.channel ?? 'discord',
      tokens_used: input.tokens_used ?? null,
      metadata: JSON.parse(JSON.stringify(input.metadata ?? {})),
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to save message');
    throw new HawkError(`Failed to save message: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as ConversationMessage;
}

export async function getSessionMessages(
  sessionId: string,
  limit = 20,
): Promise<ConversationMessage[]> {
  const { data, error } = await db
    .from('conversation_messages')
    .select('id, session_id, role, content, channel, tokens_used, metadata, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get session messages');
    throw new HawkError(`Failed to get session messages: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return ((data ?? []) as ConversationMessage[]).reverse();
}

// ── Conversation Summaries ─────────────────────────────────

export async function createSummary(input: {
  session_id: string;
  summary: string;
  key_memories_extracted?: string[];
  message_count: number;
  first_message_at: string;
  last_message_at: string;
}): Promise<ConversationSummary> {
  const { data, error } = await db
    .from('conversation_summaries')
    .insert({
      session_id: input.session_id,
      summary: input.summary,
      key_memories_extracted: input.key_memories_extracted ?? [],
      message_count: input.message_count,
      first_message_at: input.first_message_at,
      last_message_at: input.last_message_at,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create summary');
    throw new HawkError(`Failed to create summary: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as ConversationSummary;
}

// ── Session Archives ──────────────────────────────────────

export async function listSessionArchives(limit = 20, channel?: string): Promise<SessionArchive[]> {
  let query = db
    .from('session_archives')
    .select(
      'id, session_id, channel, message_count, abstract, overview, memories_extracted, token_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (channel) query = query.eq('channel', channel);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list session archives');
    throw new HawkError(`Failed to list session archives: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as SessionArchive[];
}

export async function getSessionArchive(sessionId: string): Promise<SessionArchive | null> {
  const { data, error } = await db
    .from('session_archives')
    .select(
      'id, session_id, channel, message_count, abstract, overview, messages, memories_extracted, token_count, created_at',
    )
    .eq('session_id', sessionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to get session archive');
    throw new HawkError(`Failed to get session archive: ${error.message}`, 'DB_DELETE_FAILED');
  }
  return data as unknown as SessionArchive | null;
}

// ── Intelligence Queries ──────────────────────────────────

export async function getMemoryTimeline(
  days = 30,
): Promise<Array<{ date: string; count: number }>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('agent_memories')
    .select('created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(10000);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get memory timeline');
    throw new HawkError(`Failed to get memory timeline: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const counts: Record<string, number> = {};
  for (const m of data ?? []) {
    const date = (m.created_at as string).slice(0, 10);
    counts[date] = (counts[date] ?? 0) + 1;
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

export async function getMemoryDistributions(): Promise<{
  byType: Record<string, number>;
  byModule: Record<string, number>;
}> {
  const { data, error } = await db
    .from('agent_memories')
    .select('memory_type, module')
    .eq('status', 'active')
    .limit(10000);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get memory distributions');
    throw new HawkError(`Failed to get memory distributions: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const byType: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  for (const m of data ?? []) {
    const mt = (m.memory_type as string) ?? 'unknown';
    byType[mt] = (byType[mt] ?? 0) + 1;
    const mod = m.module as string;
    if (mod) byModule[mod] = (byModule[mod] ?? 0) + 1;
  }

  return { byType, byModule };
}

// ── Knowledge Graph Links ───────────────────────────────────

export type MemoryRelationType =
  | 'related_to'
  | 'caused_by'
  | 'part_of'
  | 'contradicts'
  | 'supersedes'
  | 'references';

export async function linkMemories(
  sourceId: string,
  targetId: string,
  relationType: MemoryRelationType,
  strength = 0.5,
): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: memory_links not yet in generated types
  const { error } = await (db as any).from('memory_links').upsert(
    {
      source_id: sourceId,
      target_id: targetId,
      relation_type: relationType,
      strength,
    },
    { onConflict: 'source_id,target_id,relation_type' },
  );
  if (error) {
    logger.error({ error: error.message }, 'Failed to link memories');
    throw new HawkError(`Failed to link memories: ${error.message}`, 'DB_INSERT_FAILED');
  }
}

export async function getLinkedMemories(
  memoryId: string,
  maxHops = 1,
): Promise<
  Array<{ memory: AgentMemory; relation: MemoryRelationType; strength: number; hop: number }>
> {
  const results: Array<{
    memory: AgentMemory;
    relation: MemoryRelationType;
    strength: number;
    hop: number;
  }> = [];
  const visited = new Set<string>([memoryId]);
  let frontier = [memoryId];

  for (let hop = 1; hop <= Math.min(maxHops, 3); hop++) {
    if (frontier.length === 0) break;

    // Get all links from current frontier in one query
    // biome-ignore lint/suspicious/noExplicitAny: memory_links not yet in generated types
    const { data: links, error } = await (db as any)
      .from('memory_links')
      .select('source_id, target_id, relation_type, strength')
      .in('source_id', frontier)
      .order('strength', { ascending: false })
      .limit(hop === 1 ? 20 : 10);

    if (error) {
      logger.error({ error: error.message }, 'Failed to get linked memories');
      throw new HawkError(`Failed to get linked memories: ${error.message}`, 'DB_QUERY_FAILED');
    }

    if (!links || links.length === 0) break;

    // Filter out already-visited nodes
    const newLinks = (
      links as { source_id: string; target_id: string; relation_type: string; strength: number }[]
    ).filter((l) => !visited.has(l.target_id));

    if (newLinks.length === 0) break;

    const nextIds = newLinks.map((l) => l.target_id);
    for (const id of nextIds) visited.add(id);

    // Fetch memory details for new nodes
    const { data: memories, error: memErr } = await db
      .from('agent_memories')
      .select('id, content, category, memory_type, module, importance, created_at')
      .in('id', nextIds)
      .eq('status', 'active');

    if (memErr) {
      logger.error({ error: memErr.message }, 'Failed to fetch linked memory details');
      throw new HawkError(`Failed to fetch linked memories: ${memErr.message}`, 'DB_QUERY_FAILED');
    }

    const memoryMap = new Map((memories ?? []).map((m: any) => [m.id, m]));

    for (const link of newLinks) {
      const mem = memoryMap.get(link.target_id);
      if (mem) {
        results.push({
          memory: mem as unknown as AgentMemory,
          relation: link.relation_type as MemoryRelationType,
          strength: link.strength,
          hop,
        });
      }
    }

    frontier = nextIds;
  }

  return results;
}
