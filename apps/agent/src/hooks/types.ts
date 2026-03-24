export type HookEvent =
  | 'session:start'
  | 'session:end'
  | 'tool:before'
  | 'tool:after'
  | 'message:received'
  | 'message:sent'
  | 'automation:before'
  | 'automation:after';

export interface HookContext {
  sessionId?: string;
  channel?: 'discord' | 'web';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  message?: string;
  automationName?: string;
  [key: string]: unknown;
}

export type HookHandler = (ctx: HookContext) => Promise<void>;

export interface Hook {
  name: string;
  event: HookEvent;
  handler: HookHandler;
  /** Lower priority runs first. Default: 10 */
  priority?: number;
}
