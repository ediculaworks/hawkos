export { assembleContext, registerModule } from './assembler.ts';
export { initModuleCentroids } from './module-embeddings.ts';
export {
  extractReferences,
  formatReferencesAsContext,
  resolveReferences,
} from './context-references.ts';
export type { AssembledContext, ContextModule, ModuleRelevance } from './types.ts';
export type { ContextReference, ResolvedReference, TokenBudget } from './context-references.ts';
