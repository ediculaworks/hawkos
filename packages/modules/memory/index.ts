export type {
  AgentMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryFilters,
  MemoryCategory,
  MemoryType,
  MemoryStatus,
  ConversationMessage,
  SaveMessageInput,
  ConversationSummary,
  SessionArchive,
  ActivityLogEntry,
  MemoryGraph,
  MemoryGraphNode,
  MemoryGraphEdge,
} from './types';

export {
  createMemory,
  listMemories,
  searchMemories,
  updateMemory,
  deleteMemory,
  archiveExpiredMemories,
  getTopMemories,
  getMemoryStats,
  getMemoryGraph,
  saveMessage,
  getSessionMessages,
  createSummary,
  listSessionArchives,
  getSessionArchive,
  getMemoryTimeline,
  getMemoryDistributions,
} from './queries';

export { loadL0, loadL1, loadL2 } from './context';

// V2: OpenViking-inspired memory system
export { generateEmbedding, semanticSearchMemories, backfillEmbeddings } from './embeddings';
export { retrieveMemories, trackMemoryAccess } from './retrieval';
export { computeAdaptiveHalfLives, getAdaptiveHalfLife } from './adaptive';
export { predictImportance, learnImportanceWeights } from './importance-scorer';
export { extractMemoriesByRules } from './rule-extractor';
export { deduplicateMemory, applyDedupResult } from './deduplicator';
export type { MemoryCandidate } from './deduplicator';
export {
  commitSession,
  findExpiredSessions,
  getLastSessionArchive,
  generateMemoryLayers,
} from './session-commit';

// Data gaps + onboarding questions
export {
  detectDataGaps,
  getNextQuestion,
  markQuestionAsked,
  markQuestionAnswered,
  insertDynamicQuestion,
  persistDataGaps,
  getQuestionStats,
} from './data-gaps';
export type { OnboardingQuestion, DataGap } from './data-gaps';
