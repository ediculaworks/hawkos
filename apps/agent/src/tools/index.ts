import type OpenAI from 'openai';

import { analyticsTools } from './analytics.js';
import { calendarTools } from './calendar.js';
import { careerTools } from './career.js';
import { demandTools } from './demands.js';
import { extensionTools } from './extensions.js';
import { filesystemTools } from './filesystem.js';
import { financeTools } from './finances.js';
import { gitTools } from './git.js';
import { githubTools } from './github.js';
import { healthTools } from './health.js';
import { knowledgeTools } from './knowledge.js';
import { mediaTools } from './media.js';
import { objectiveTools } from './objectives.js';
import { otherModuleTools } from './other-modules.js';
import { peopleTools } from './people.js';
import { routineTools } from './routine.js';
import { shellTools } from './shell.js';
import type { ToolDefinition } from './types.js';
import { universalTools } from './universal.js';
import { webTools } from './web.js';

// Re-export types
export type { ToolDefinition } from './types.js';

// ── Collect all tools ────────────────────────────────────────────────

export const TOOLS: Record<string, ToolDefinition> = {
  ...financeTools,
  ...routineTools,
  ...objectiveTools,
  ...peopleTools,
  ...calendarTools,
  ...healthTools,
  ...knowledgeTools,
  ...otherModuleTools,
  ...universalTools,
  ...shellTools,
  ...gitTools,
  ...filesystemTools,
  ...webTools,
  ...mediaTools,
  ...analyticsTools,
  ...githubTools,
  ...careerTools,
  ...extensionTools,
  ...demandTools,
};

export type ToolName = keyof typeof TOOLS;

/**
 * Get tools filtered by detected modules.
 * Universal tools (modules: []) are always included.
 * Returns both the OpenAI tool definitions and the handler map.
 */
export function getToolsForModules(detectedModules: string[]): {
  tools: OpenAI.ChatCompletionTool[];
  toolMap: Map<string, ToolDefinition>;
} {
  const detected = new Set(detectedModules);

  const filtered = Object.values(TOOLS).filter((tool) => {
    // Universal tools: always included
    if (tool.modules.length === 0) return true;
    // Module-specific: include if any module matches
    return tool.modules.some((m) => detected.has(m));
  });

  const tools: OpenAI.ChatCompletionTool[] = filtered.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const toolMap = new Map(filtered.map((tool) => [tool.name, tool]));

  return { tools, toolMap };
}
