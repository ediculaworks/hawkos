import type { ModuleId } from '@hawk/shared';
import type { z } from 'zod';

export type PrerequisiteDefinition = {
  /** Unique identifier matched against prerequisite-registry.ts checkers */
  name: string;
  /** Message shown to the user explaining what needs to be done first */
  message: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  modules: ModuleId[];
  /** If true, the agent MUST confirm with the user before executing */
  dangerous?: boolean;
  /**
   * Prerequisites that must be satisfied before this tool can run.
   * Checked by the prerequisite guard in tool-executor.ts.
   * If any fail, the intent is saved to pending_intents and a guiding message is returned.
   */
  prerequisites?: PrerequisiteDefinition[];
  /**
   * If true, the tool result includes an [UNDO:actionId] tag.
   * The Discord adapter strips it and shows a "Desfazer" button for 60s.
   * The tool handler is responsible for calling registerUndoAction() from undo-store.ts.
   */
  undoable?: boolean;
  /** Zod schema for server-side input validation. Validated before handler is called. */
  // biome-ignore lint/suspicious/noExplicitAny: intentional for generic tool schema
  schema?: z.ZodType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: tool handlers use typed args that are subsets of Record<string, unknown>
  handler: (args: any) => Promise<string>;
};
