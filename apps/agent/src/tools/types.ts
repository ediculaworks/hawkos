import type { ModuleId } from '@hawk/shared';
import type { z } from 'zod';

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  modules: ModuleId[];
  /** If true, the agent MUST confirm with the user before executing */
  dangerous?: boolean;
  /** Zod schema for server-side input validation. Validated before handler is called. */
  // biome-ignore lint/suspicious/noExplicitAny: intentional for generic tool schema
  schema?: z.ZodType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: tool handlers use typed args that are subsets of Record<string, unknown>
  handler: (args: any) => Promise<string>;
};
