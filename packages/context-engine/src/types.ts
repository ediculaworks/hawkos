import type { ModuleId } from '@hawk/shared';

export interface ContextModule {
  id: ModuleId;
  getL0(): string;
  getL1(): Promise<string>;
  getL2(query: string): Promise<string>;
}

export type ModuleRelevance = {
  id: ModuleId;
  score: number;
};

export interface AssembledContext {
  l0: string; // sempre carregado — todos os módulos
  l1: string; // módulos detectados como relevantes
  l2: string; // dados específicos se necessário
  modulesLoaded: ModuleId[];
  relevanceScores: ModuleRelevance[];
}
