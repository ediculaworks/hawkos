import type { ModuleId } from '@hawk/shared';

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  modules: ModuleId[];
  /** If true, the agent MUST confirm with the user before executing */
  dangerous?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: tool handlers have specific typed args
  handler: (args: any) => Promise<string>;
};
