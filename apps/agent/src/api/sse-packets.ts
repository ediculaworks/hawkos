/**
 * Typed SSE Streaming Packets — 40+ event types for rich real-time feedback.
 *
 * Defines all event types emitted via SSE and WebSocket, with typed payloads.
 * Ensures consistent wire format across all real-time channels.
 *
 * Inspired by Onyx's typed SSE streaming pattern.
 */

// ── Packet Type Definitions ──────────────────────────────────────────────────

/** All SSE/WebSocket event types */
export type SSEEventType =
  // ── Connection lifecycle ──
  | 'connected'
  | 'disconnected'
  | 'heartbeat'
  | 'pong'

  // ── Chat session ──
  | 'chat_joined'
  | 'chat_typing'
  | 'chat_chunk'
  | 'chat_message'
  | 'chat_error'

  // ── Tool execution ──
  | 'chat_tool_call'
  | 'tool_start'
  | 'tool_progress'
  | 'tool_result'
  | 'tool_error'
  | 'tool_approval_required'
  | 'tool_approved'
  | 'tool_denied'

  // ── Session management ──
  | 'session_started'
  | 'session_ended'
  | 'session_cost'
  | 'session_compressed'

  // ── Module detection ──
  | 'modules_detected'
  | 'model_selected'
  | 'context_loaded'

  // ── Memory operations ──
  | 'memory_created'
  | 'memory_merged'
  | 'memory_retrieved'
  | 'memory_graph_updated'

  // ── Automation ──
  | 'automation_triggered'
  | 'automation_started'
  | 'automation_progress'
  | 'automation_completed'
  | 'automation_failed'
  | 'automation_skipped'

  // ── Demand processing ──
  | 'demand_created'
  | 'demand_progress'
  | 'demand_completed'
  | 'demand_failed'

  // ── Security ──
  | 'injection_detected'
  | 'secret_redacted'

  // ── System ──
  | 'error'
  | 'client_error'
  | 'status_update'
  | 'trigger_ack'
  | 'kill_ack';

// ── Typed Payloads ───────────────────────────────────────────────────────────

export interface SSEPacketMap {
  // Connection
  connected: { clientId?: string; status: string; uptime?: number };
  disconnected: { reason?: string };
  heartbeat: { status: string; uptime: number; sessions: number };
  pong: Record<string, never>;

  // Chat
  chat_joined: { sessionId: string };
  chat_typing: { sessionId: string };
  chat_chunk: { sessionId: string; content: string };
  chat_message: { sessionId: string; content: string; role: string };
  chat_error: { sessionId?: string; error: string };

  // Tools
  chat_tool_call: {
    sessionId: string;
    name: string;
    args: Record<string, unknown>;
    result: string;
    durationMs?: number;
  };
  tool_start: { sessionId: string; name: string; args: Record<string, unknown> };
  tool_progress: { sessionId: string; name: string; progress: number; message?: string };
  tool_result: { sessionId: string; name: string; result: string; durationMs: number };
  tool_error: { sessionId: string; name: string; error: string };
  tool_approval_required: { sessionId: string; name: string; args: Record<string, unknown> };
  tool_approved: { sessionId: string; name: string };
  tool_denied: { sessionId: string; name: string };

  // Sessions
  session_started: { sessionId: string; channel: string };
  session_ended: { sessionId: string; channel: string };
  session_cost: { sessionId: string; tokens: number; cost: number; llmCalls: number };
  session_compressed: { sessionId: string; originalTokens: number; compressedTokens: number };

  // Module detection
  modules_detected: { modules: string[]; scores: Array<{ id: string; score: number }> };
  model_selected: { model: string; complexity: string; baseModel: string };
  context_loaded: { modulesLoaded: string[]; l0Tokens: number; l1Tokens: number; l2Tokens: number };

  // Memory
  memory_created: { memoryId: string; type: string; module?: string; preview: string };
  memory_merged: { memoryId: string; mergedIntoId: string };
  memory_retrieved: { count: number; topScore: number };
  memory_graph_updated: { nodes: number; edges: number };

  // Automation
  automation_triggered: { name: string };
  automation_started: { name: string; automationId: string };
  automation_progress: { name: string; step: number; totalSteps: number; message: string };
  automation_completed: { name: string; result?: string; durationMs: number };
  automation_failed: { name: string; error: string };
  automation_skipped: { name: string; reason: string };

  // Demands
  demand_created: { demandId: string; title: string };
  demand_progress: { demandId: string; status: string; message?: string };
  demand_completed: { demandId: string; result: string };
  demand_failed: { demandId: string; error: string };

  // Security
  injection_detected: { threatLevel: string; score: number; patterns: string[] };
  secret_redacted: { count: number; patterns: string[] };

  // System
  error: { message: string; code?: string; component?: string };
  client_error: { message: string; component?: string; stack?: string };
  status_update: { status: string; message: string };
  trigger_ack: { automation: string };
  kill_ack: { sessionId: string };
}

// ── Packet Builder ───────────────────────────────────────────────────────────

export interface SSEPacket<T extends SSEEventType = SSEEventType> {
  type: T;
  timestamp: string;
  data: T extends keyof SSEPacketMap ? SSEPacketMap[T] : Record<string, unknown>;
}

/**
 * Create a typed SSE packet with automatic timestamp.
 */
export function createPacket<T extends SSEEventType>(
  type: T,
  data: T extends keyof SSEPacketMap ? SSEPacketMap[T] : Record<string, unknown>,
): SSEPacket<T> {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
}

/**
 * Serialize a packet for SSE wire format.
 */
export function serializeSSE<T extends SSEEventType>(packet: SSEPacket<T>): string {
  return `event: ${packet.type}\ndata: ${JSON.stringify({ ...packet.data, timestamp: packet.timestamp })}\n\n`;
}

/**
 * Serialize a packet for WebSocket wire format.
 */
export function serializeWS<T extends SSEEventType>(packet: SSEPacket<T>): string {
  return JSON.stringify({ type: packet.type, timestamp: packet.timestamp, ...packet.data });
}
