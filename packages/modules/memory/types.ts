export type MemoryCategory =
  | 'preference'
  | 'fact'
  | 'pattern'
  | 'insight'
  | 'correction'
  | 'goal'
  | 'relationship';

/** OpenViking-inspired 7-category memory type system */
export type MemoryType =
  | 'profile' // user identity/attributes (append-only merge)
  | 'preference' // user preferences by topic (mergeable)
  | 'entity' // people, projects, places (mergeable)
  | 'event' // decisions, milestones, happenings (non-mergeable)
  | 'case' // problem + solution learned (non-mergeable)
  | 'pattern' // reusable process/method (mergeable)
  | 'procedure'; // learned behavior corrections, operational rules (mergeable, long-lived)

export type MemoryStatus = 'active' | 'pending' | 'rejected' | 'archived';

export type AgentMemory = {
  id: string;
  category: MemoryCategory;
  memory_type: MemoryType;
  content: string;
  module: string | null;
  related_modules: string[];
  source_message_id: string | null;
  importance: number;
  confidence: number;
  status: MemoryStatus;
  last_accessed: string;
  access_count: number;
  expires_at: string | null;
  tags: string[];
  mergeable: boolean;
  origin_session_id: string | null;
  /** Hierarchical path (e.g. 'preference/health', 'entity/people') */
  path: string | null;
  /** L0: ~15 words, optimized for vector search */
  l0_abstract: string | null;
  /** L1: 2 paragraphs with key facts and usage hints */
  l1_overview: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateMemoryInput = {
  category: MemoryCategory;
  content: string;
  module?: string;
  related_modules?: string[];
  source_message_id?: string;
  importance?: number;
  confidence?: number;
  status?: MemoryStatus;
  tags?: string[];
};

export type UpdateMemoryInput = {
  content?: string;
  category?: MemoryCategory;
  module?: string;
  related_modules?: string[];
  importance?: number;
  confidence?: number;
  status?: MemoryStatus;
  tags?: string[];
  expires_at?: string | null;
};

export type MemoryFilters = {
  category?: MemoryCategory;
  memory_type?: MemoryType;
  module?: string;
  status?: MemoryStatus;
  minImportance?: number;
  search?: string;
  sort?: 'created_at' | 'importance' | 'access_count' | 'last_accessed';
  limit?: number;
  offset?: number;
};

export type ConversationMessage = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  channel: string;
  tokens_used: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SaveMessageInput = {
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  channel?: string;
  tokens_used?: number | null;
  metadata?: Record<string, unknown>;
};

export type ConversationSummary = {
  id: string;
  session_id: string;
  summary: string;
  key_memories_extracted: string[];
  message_count: number;
  first_message_at: string;
  last_message_at: string;
  created_at: string;
};

export type MemoryGraphNode = {
  id: string;
  category: MemoryCategory;
  memory_type: MemoryType;
  content: string;
  module: string | null;
  related_modules: string[];
  importance: number;
  access_count: number;
  status: MemoryStatus;
};

export type MemoryGraphEdge = {
  source: string;
  target: string;
  shared_module: string;
};

export type MemoryGraph = {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
};

export type SessionArchive = {
  id: string;
  session_id: string;
  channel: string;
  message_count: number;
  abstract: string;
  overview: string;
  messages: Array<{ role: string; content: string; created_at: string }>;
  memories_extracted: number;
  token_count: number | null;
  created_at: string;
};

export type ActivityLogEntry = {
  id: string;
  event_type: string;
  module: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
