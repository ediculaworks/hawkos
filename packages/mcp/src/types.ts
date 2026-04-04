/**
 * MCP (Model Context Protocol) types for Hawk OS.
 *
 * Defines the protocol messages and interfaces for both
 * MCP client (connecting to external tools) and MCP server
 * (exposing Hawk OS tools to external agents).
 */

// ── Protocol Types ───────────────────────────────────────────────────────────

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ── Connection Types ─────────────────────────────────────────────────────────

export type MCPTransport = 'stdio' | 'sse';

export interface MCPServerConfig {
  /** Unique identifier for this server */
  id: string;
  /** Display name */
  name: string;
  /** Transport type */
  transport: MCPTransport;
  /** Command to start server (stdio) or URL (sse) */
  command?: string;
  args?: string[];
  url?: string;
  /** Environment variables to pass */
  env?: Record<string, string>;
  /** Auto-connect on startup */
  autoConnect?: boolean;
  /** Which tools to enable (empty = all) */
  enabledTools?: string[];
}

export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPConnection {
  config: MCPServerConfig;
  status: MCPConnectionStatus;
  serverInfo: MCPServerInfo | null;
  availableTools: MCPToolDefinition[];
  availableResources: MCPResource[];
  availablePrompts: MCPPrompt[];
  error: string | null;
  connectedAt: number | null;
}
