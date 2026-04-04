/**
 * Routing middleware — module detection, tool filtering, model selection, ReAct detection.
 */

import { logActivity } from '../activity-logger.js';
import { classifyComplexity, selectModel } from '../model-router.js';
import { getToolsForModules } from '../tools/index.js';
import type { HandlerContext, Middleware } from './types.js';

export const routingMiddleware: Middleware = {
  name: 'routing',
  execute: async (ctx: HandlerContext, next) => {
    // Dynamic tool routing — filter by detected modules intersected with agent's scope
    ctx.allowedModules =
      ctx.agent.toolsEnabled.length > 0
        ? ctx.context.modulesLoaded.filter((m) => ctx.agent.toolsEnabled.includes(m))
        : ctx.context.modulesLoaded;

    const { tools, toolMap } = getToolsForModules(ctx.allowedModules);
    ctx.filteredTools = tools;
    ctx.toolMap = toolMap;

    // Smart model routing
    ctx.complexity = classifyComplexity(ctx.sanitizedMessage, ctx.context.relevanceScores.length);
    ctx.selectedModel = selectModel(ctx.complexity, ctx.agent.model);

    // ReAct detection
    const reactEnabled =
      ctx.agent.reactMode === 'always' ||
      (ctx.agent.reactMode === 'auto' &&
        (ctx.context.relevanceScores.length >= 2 ||
          /\b(analis|compar|plan[ei]j|revis|resum|organiz|avali|otimiz|prioriz)/i.test(
            ctx.sanitizedMessage,
          )));
    ctx.isComplexQuery = reactEnabled;

    // Log module detection
    logActivity(
      'module_detection',
      `Detected: ${ctx.allowedModules.join(', ') || 'none'}`,
      undefined,
      {
        detected_modules: ctx.allowedModules,
        relevance_scores: ctx.context.relevanceScores,
        message_preview: ctx.sanitizedMessage.slice(0, 120),
        tools_offered: tools.map((t) => (t as { function: { name: string } }).function.name),
        complexity: ctx.complexity,
        selected_model: ctx.selectedModel,
        base_model: ctx.agent.model,
      },
    ).catch(() => {});

    await next();
  },
};
