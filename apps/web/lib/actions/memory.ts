'use server';

import {
  computeAdaptiveHalfLives,
  createMemory,
  deleteMemory,
  detectDataGaps,
  getMemoryDistributions,
  getMemoryGraph,
  getMemoryStats,
  getMemoryTimeline,
  getQuestionStats,
  getSessionArchive,
  listMemories,
  listSessionArchives,
  searchMemories,
  updateMemory,
} from '@hawk/module-memory';
import type {
  AgentMemory,
  CreateMemoryInput,
  MemoryFilters,
  MemoryGraph,
  SessionArchive,
  UpdateMemoryInput,
} from '@hawk/module-memory/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchMemories(filters?: MemoryFilters): Promise<AgentMemory[]> {
  return withTenant(async () => listMemories(filters));
}

export async function fetchMemoryGraph(): Promise<MemoryGraph> {
  return withTenant(async () => getMemoryGraph());
}

export async function fetchMemoryStats() {
  return withTenant(async () => getMemoryStats());
}

export async function searchMemoriesAction(query: string): Promise<AgentMemory[]> {
  return withTenant(async () => searchMemories(query));
}

export async function createMemoryAction(input: CreateMemoryInput): Promise<AgentMemory> {
  return withTenant(async () => createMemory(input));
}

export async function updateMemoryAction(
  id: string,
  input: UpdateMemoryInput,
): Promise<AgentMemory> {
  return withTenant(async () => updateMemory(id, input));
}

export async function deleteMemoryAction(id: string): Promise<void> {
  return withTenant(async () => deleteMemory(id));
}

// ── Session Archives ──────────────────────────────────────

export async function fetchSessionArchives(
  limit = 20,
  channel?: string,
): Promise<SessionArchive[]> {
  return withTenant(async () => listSessionArchives(limit, channel));
}

export async function fetchSessionArchive(sessionId: string): Promise<SessionArchive | null> {
  return withTenant(async () => getSessionArchive(sessionId));
}

// ── Intelligence ──────────────────────────────────────────

export async function fetchMemoryTimeline(days = 30) {
  return withTenant(async () => getMemoryTimeline(days));
}

export async function fetchMemoryDistributions() {
  return withTenant(async () => getMemoryDistributions());
}

export async function fetchAdaptiveHalfLives() {
  return withTenant(async () => computeAdaptiveHalfLives());
}

export async function fetchDataGaps() {
  return withTenant(async () => detectDataGaps());
}

export async function fetchQuestionStats() {
  return withTenant(async () => getQuestionStats());
}
