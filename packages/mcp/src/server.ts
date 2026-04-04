/**
 * MCP Server — exposes Hawk OS tools to external MCP clients.
 *
 * TODO: NOT YET INTEGRATED — never initialized, no tools registered.
 * To activate: call startMCPServer() in agent startup with registered tools.
 *
 * Allows external AI agents (Claude, GPT, etc.) to use Hawk OS
 * tools through the MCP protocol.
 *
 * Runs as a separate process or alongside the agent.
 */

import { createLogger } from '@hawk/shared';
import type { MCPResource, MCPServerInfo, MCPToolCallResult, MCPToolDefinition } from './types.ts';

const logger = createLogger('mcp-server');

// ── Server Configuration ─────────────────────────────────────────────────────

const SERVER_INFO: MCPServerInfo = {
  name: 'hawk-os',
  version: '0.1.0',
  capabilities: {
    tools: true,
    resources: true,
    prompts: false,
  },
};

// ── Tool Registry ────────────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>) => Promise<MCPToolCallResult>;

const _tools = new Map<string, { definition: MCPToolDefinition; handler: ToolHandler }>();

/**
 * Register a Hawk OS tool for MCP exposure.
 */
export function registerMCPTool(definition: MCPToolDefinition, handler: ToolHandler): void {
  _tools.set(definition.name, { definition, handler });
  logger.info({ tool: definition.name }, 'MCP tool registered');
}

/**
 * List all available tools.
 */
export function listTools(): MCPToolDefinition[] {
  return [..._tools.values()].map((t) => t.definition);
}

/**
 * Execute a tool by name.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<MCPToolCallResult> {
  const tool = _tools.get(name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Tool not found: ${name}` }],
      isError: true,
    };
  }

  try {
    return await tool.handler(args);
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Tool error: ${err instanceof Error ? err.message : String(err)}` },
      ],
      isError: true,
    };
  }
}

// ── Resource Registry ────────────────────────────────────────────────────────

type ResourceReader = () => Promise<{ content: string; mimeType: string }>;

const _resources = new Map<string, { definition: MCPResource; reader: ResourceReader }>();

/**
 * Register a Hawk OS resource for MCP exposure.
 */
export function registerMCPResource(definition: MCPResource, reader: ResourceReader): void {
  _resources.set(definition.uri, { definition, reader });
}

/**
 * List all available resources.
 */
export function listResources(): MCPResource[] {
  return [..._resources.values()].map((r) => r.definition);
}

/**
 * Read a resource by URI.
 */
export async function readResource(
  uri: string,
): Promise<{ content: string; mimeType: string } | null> {
  const resource = _resources.get(uri);
  if (!resource) return null;
  return resource.reader();
}

// ── Server Info ──────────────────────────────────────────────────────────────

export function getServerInfo(): MCPServerInfo {
  return SERVER_INFO;
}

export function getServerStats(): {
  tools: number;
  resources: number;
} {
  return {
    tools: _tools.size,
    resources: _resources.size,
  };
}
