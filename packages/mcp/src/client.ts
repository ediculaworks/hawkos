/**
 * MCP Client — Discovery-first setup.
 *
 * TODO: NOT YET INTEGRATED — transports are stubs, never imported by agent.
 * To activate: implement real JSON-RPC transport and wire into tool-executor.
 *
 * Connects to MCP servers, discovers available tools/resources/prompts,
 * and exposes them as Hawk OS tools for the agent to use.
 *
 * Flow: connect → discover → select tools → ready
 *
 * Inspired by Hermes Agent's MCP discovery-first pattern.
 */

import { createLogger } from '@hawk/shared';
import type {
  MCPConnection,
  MCPServerConfig,
  MCPToolCallResult,
  MCPToolDefinition,
} from './types.ts';

const logger = createLogger('mcp-client');

// ── Connection Registry ──────────────────────────────────────────────────────

const _connections = new Map<string, MCPConnection>();

/**
 * Get all registered MCP connections and their status.
 */
export function getConnections(): MCPConnection[] {
  return [..._connections.values()];
}

/**
 * Get a specific connection by server ID.
 */
export function getConnection(serverId: string): MCPConnection | null {
  return _connections.get(serverId) ?? null;
}

// ── Discovery-First Setup ────────────────────────────────────────────────────

/**
 * Connect to an MCP server and discover its capabilities.
 * Returns the connection with available tools/resources/prompts listed.
 *
 * Step 1 of discovery-first: connect → discover
 */
export async function connectServer(config: MCPServerConfig): Promise<MCPConnection> {
  const connection: MCPConnection = {
    config,
    status: 'connecting',
    serverInfo: null,
    availableTools: [],
    availableResources: [],
    availablePrompts: [],
    error: null,
    connectedAt: null,
  };

  _connections.set(config.id, connection);

  try {
    if (config.transport === 'stdio') {
      await connectViaStdio(connection);
    } else if (config.transport === 'sse') {
      await connectViaSSE(connection);
    } else {
      throw new Error(`Unsupported transport: ${config.transport}`);
    }

    connection.status = 'connected';
    connection.connectedAt = Date.now();
    logger.info(
      {
        serverId: config.id,
        tools: connection.availableTools.length,
        resources: connection.availableResources.length,
      },
      `MCP server connected: ${config.name}`,
    );

    return connection;
  } catch (err) {
    connection.status = 'error';
    connection.error = err instanceof Error ? err.message : String(err);
    logger.error({ serverId: config.id, err }, `MCP server connection failed: ${config.name}`);
    return connection;
  }
}

/**
 * Select which discovered tools to enable for agent use.
 *
 * Step 2 of discovery-first: select tools
 */
export function selectTools(serverId: string, toolNames: string[]): void {
  const conn = _connections.get(serverId);
  if (!conn) throw new Error(`MCP server not found: ${serverId}`);

  conn.config.enabledTools = toolNames;
  logger.info({ serverId, tools: toolNames }, 'MCP tools selected');
}

/**
 * Get all enabled tools across all connected MCP servers.
 * Returns in Hawk OS tool format (ready for agent use).
 */
export function getEnabledMCPTools(): Array<{
  name: string;
  serverId: string;
  definition: MCPToolDefinition;
}> {
  const tools: Array<{ name: string; serverId: string; definition: MCPToolDefinition }> = [];

  for (const conn of _connections.values()) {
    if (conn.status !== 'connected') continue;

    for (const tool of conn.availableTools) {
      // If enabledTools is set, only include selected tools
      if (conn.config.enabledTools && conn.config.enabledTools.length > 0) {
        if (!conn.config.enabledTools.includes(tool.name)) continue;
      }
      tools.push({
        name: `mcp_${conn.config.id}_${tool.name}`,
        serverId: conn.config.id,
        definition: tool,
      });
    }
  }

  return tools;
}

/**
 * Execute a tool call on an MCP server.
 */
export async function callMCPTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<MCPToolCallResult> {
  const conn = _connections.get(serverId);
  if (!conn || conn.status !== 'connected') {
    return {
      content: [{ type: 'text', text: `MCP server ${serverId} not connected` }],
      isError: true,
    };
  }

  // For now, return a placeholder — actual transport implementation
  // depends on the MCP SDK being installed
  logger.info({ serverId, tool: toolName }, 'MCP tool call');

  return {
    content: [
      {
        type: 'text',
        text: `[MCP] Tool ${toolName} called on ${conn.config.name} with args: ${JSON.stringify(args)}`,
      },
    ],
  };
}

/**
 * Disconnect from an MCP server.
 */
export async function disconnectServer(serverId: string): Promise<void> {
  const conn = _connections.get(serverId);
  if (!conn) return;

  conn.status = 'disconnected';
  conn.connectedAt = null;
  logger.info({ serverId }, 'MCP server disconnected');
}

/**
 * Disconnect all MCP servers (called during shutdown).
 */
export async function disconnectAll(): Promise<void> {
  for (const serverId of _connections.keys()) {
    await disconnectServer(serverId);
  }
}

// ── Transport Implementations ────────────────────────────────────────────────

async function connectViaStdio(connection: MCPConnection): Promise<void> {
  const { config } = connection;
  if (!config.command) throw new Error('stdio transport requires command');

  // Placeholder: spawn the child process and exchange JSON-RPC
  // Full implementation requires the MCP SDK
  logger.info({ command: config.command, args: config.args }, 'Connecting via stdio');

  // Simulate discovery for now
  connection.serverInfo = {
    name: config.name,
    version: '0.1.0',
    capabilities: { tools: true, resources: false, prompts: false },
  };

  // In real implementation: send initialize request, then tools/list
  connection.availableTools = [];
}

async function connectViaSSE(connection: MCPConnection): Promise<void> {
  const { config } = connection;
  if (!config.url) throw new Error('SSE transport requires url');

  // Placeholder: connect to SSE endpoint and exchange JSON-RPC
  logger.info({ url: config.url }, 'Connecting via SSE');

  connection.serverInfo = {
    name: config.name,
    version: '0.1.0',
    capabilities: { tools: true, resources: true, prompts: true },
  };

  connection.availableTools = [];
}

// ── Server Discovery Helper ──────────────────────────────────────────────────

/**
 * Discover and list server capabilities in a human-readable format.
 * Used by agent to present available tools to the user.
 */
export function describeServer(serverId: string): string {
  const conn = _connections.get(serverId);
  if (!conn) return `Server ${serverId} not found`;

  const lines = [
    `## ${conn.config.name}`,
    `Status: ${conn.status}`,
    conn.serverInfo ? `Version: ${conn.serverInfo.version}` : '',
    '',
    `### Tools (${conn.availableTools.length})`,
    ...conn.availableTools.map((t) => `- **${t.name}**: ${t.description}`),
    '',
    `### Enabled: ${conn.config.enabledTools?.join(', ') || 'all'}`,
  ];

  return lines.filter(Boolean).join('\n');
}
