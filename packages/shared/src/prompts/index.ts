/**
 * Prompt Pattern Registry — Fabric-inspired pattern library.
 *
 * Patterns are registered programmatically and can be loaded by ID.
 * Templates use {{variable}} syntax for interpolation.
 */

import type { PatternDefinition } from './types.js';

export type { PatternDefinition, PatternInput } from './types.js';

// ── Registry ────────────────────────────────────────────────

const _patterns = new Map<string, PatternDefinition>();

export function registerPattern(pattern: PatternDefinition): void {
  // Validate that requiredVars exist as {{var}} in template
  for (const v of pattern.requiredVars) {
    if (!pattern.template.includes(`{{${v}}}`)) {
      throw new Error(
        `Pattern "${pattern.id}": requiredVar "${v}" not found as {{${v}}} in template`,
      );
    }
  }
  _patterns.set(pattern.id, pattern);
}

export function getPattern(id: string): PatternDefinition | undefined {
  return _patterns.get(id);
}

export function listPatterns(module?: string): PatternDefinition[] {
  const all = [..._patterns.values()];
  if (!module) return all;
  return all.filter((p) => p.module === module || p.module === 'universal');
}

export function listPatternIds(): string[] {
  return [..._patterns.keys()];
}

// ── Interpolation ───────────────────────────────────────────

/**
 * Render a pattern template with provided variables.
 * Replaces {{variable}} placeholders with values.
 * Applies defaults for optional variables not provided.
 */
export function renderPattern(
  pattern: PatternDefinition,
  variables: Record<string, string>,
): string {
  // Check required variables
  for (const key of pattern.requiredVars) {
    if (!(key in variables)) {
      throw new Error(`Missing required variable "${key}" for pattern "${pattern.id}"`);
    }
  }

  // Merge with defaults
  const merged = { ...pattern.optionalVars, ...variables };

  // Interpolate (uses replaceAll to avoid RegExp ReDoS with special chars in keys)
  let result = pattern.template;
  for (const [key, value] of Object.entries(merged)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }

  // Warn about unresolved placeholders
  const unresolved = result.match(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g);
  if (unresolved) {
    // biome-ignore lint/suspicious/noConsole: intentional developer warning for unresolved template vars
    console.warn(
      `[prompts] renderPattern "${pattern.id}": unresolved placeholders: ${unresolved.join(', ')}`,
    );
  }

  return result;
}

/**
 * Convenience: get pattern by ID and render it.
 */
export function executePattern(patternId: string, variables: Record<string, string>): string {
  const pattern = getPattern(patternId);
  if (!pattern) {
    throw new Error(`Pattern "${patternId}" not found`);
  }
  return renderPattern(pattern, variables);
}

// ── Built-in Patterns ───────────────────────────────────────

// Finance patterns
registerPattern({
  id: 'finances/analyze-spending',
  name: 'Análise de Gastos',
  description: 'Analisa padrões de gastos num período',
  module: 'finances',
  template: `Analisa os gastos do período {{period}}.

Foca em:
1. Total gasto por categoria
2. Categorias com maior crescimento vs período anterior
3. Gastos recorrentes vs pontuais
4. Sugestões de economia baseadas nos padrões

{{extra_context}}

Formato: Tabela resumo + 3 insights principais + 1 sugestão actionável.`,
  requiredVars: ['period'],
  optionalVars: { extra_context: '' },
});

registerPattern({
  id: 'finances/categorize-transaction',
  name: 'Categorizar Transação',
  description: 'Categoriza uma transação automaticamente',
  module: 'finances',
  template: `Categoriza esta transação:
Descrição: {{description}}
Valor: {{amount}}
Tipo: {{type}}

Categorias disponíveis: alimentação, transporte, moradia, saúde, educação, lazer, compras, serviços, investimento, outros.
Retorna APENAS o nome da categoria, sem explicação.`,
  requiredVars: ['description', 'amount', 'type'],
});

registerPattern({
  id: 'finances/monthly-summary',
  name: 'Resumo Mensal',
  description: 'Gera resumo financeiro do mês',
  module: 'finances',
  template: `Gera um resumo financeiro do mês {{month}}.

Dados disponíveis:
{{data}}

Inclui:
- Receita total vs despesa total
- Top 5 categorias de gasto
- Variação vs mês anterior (se disponível)
- Score de saúde financeira (0-100)
- Uma recomendação para o próximo mês`,
  requiredVars: ['month', 'data'],
});

// Health patterns
registerPattern({
  id: 'health/extract-trends',
  name: 'Extrair Tendências de Saúde',
  description: 'Identifica tendências nos dados de saúde',
  module: 'health',
  template: `Analisa os dados de saúde do período {{period}}:

{{data}}

Identifica:
1. Tendências de sono (duração, qualidade, consistência)
2. Padrões de exercício (frequência, tipos, progressão)
3. Correlações notáveis (sono vs treino, humor vs atividade)
4. Alertas ou anomalias

Formato conciso, máximo 300 palavras.`,
  requiredVars: ['period', 'data'],
});

registerPattern({
  id: 'health/sleep-analysis',
  name: 'Análise de Sono',
  description: 'Analisa qualidade e padrões de sono',
  module: 'health',
  template: `Analisa o padrão de sono dos últimos {{days}} dias:

{{sleep_data}}

Avalia:
- Duração média vs recomendado (7-9h)
- Consistência de horários
- Qualidade subjetiva
- Dívida de sono acumulada
- 1 sugestão de melhoria`,
  requiredVars: ['days', 'sleep_data'],
});

// Career patterns
registerPattern({
  id: 'career/weekly-progress',
  name: 'Progresso Semanal',
  description: 'Resume progresso profissional da semana',
  module: 'career',
  template: `Resume o progresso profissional da semana {{week}}:

{{activities}}

Estrutura:
- Conquistas (o que foi feito)
- Em progresso (o que está em andamento)
- Bloqueios (o que precisa de atenção)
- Próxima semana (prioridades sugeridas)`,
  requiredVars: ['week', 'activities'],
});

// Objectives patterns
registerPattern({
  id: 'objectives/goal-decomposition',
  name: 'Decomposição de Objetivo',
  description: 'Decompõe um objetivo em passos actionáveis',
  module: 'objectives',
  template: `Decompõe este objetivo em passos actionáveis:

Objetivo: {{goal}}
Prazo: {{deadline}}
Contexto: {{context}}

Gera:
1. 3-7 marcos intermediários com datas
2. Para cada marco: 2-3 ações concretas
3. Métricas de progresso mensuráveis
4. Dependências ou pré-requisitos
5. Primeiro passo para começar AGORA`,
  requiredVars: ['goal', 'deadline'],
  optionalVars: { context: '' },
});

registerPattern({
  id: 'objectives/progress-review',
  name: 'Revisão de Progresso',
  description: 'Revisa progresso em objetivos ativos',
  module: 'objectives',
  template: `Revisa o progresso dos objetivos ativos:

{{objectives_data}}

Para cada objetivo:
- % completado vs esperado
- Velocidade (on track / atrasado / adiantado)
- Bloqueios identificados
- Sugestão de ajuste se necessário

Finaliza com: prioridade recomendada para esta semana.`,
  requiredVars: ['objectives_data'],
});

// Universal patterns
registerPattern({
  id: 'universal/summarize',
  name: 'Resumir Texto',
  description: 'Resume qualquer texto de forma concisa',
  module: 'universal',
  template: `Resume o seguinte conteúdo em {{max_words}} palavras:

{{content}}

Mantém os pontos-chave e dados quantitativos. Remove redundâncias.`,
  requiredVars: ['content'],
  optionalVars: { max_words: '150' },
});

registerPattern({
  id: 'universal/extract-facts',
  name: 'Extrair Factos',
  description: 'Extrai factos estruturados de texto livre',
  module: 'universal',
  template: `Extrai todos os factos concretos do seguinte texto:

{{text}}

Formato de saída (JSON array):
[
  { "fact": "...", "category": "...", "confidence": 0.0-1.0 }
]

Categorias: preference, fact, relationship, goal, event, pattern.
Confidence: 1.0 = afirmado diretamente, 0.5 = implícito, 0.3 = incerto.`,
  requiredVars: ['text'],
});

registerPattern({
  id: 'universal/create-action-items',
  name: 'Criar Action Items',
  description: 'Extrai tarefas actionáveis de uma conversa',
  module: 'universal',
  template: `Extrai action items da seguinte conversa/texto:

{{text}}

Para cada item:
- Ação (verbo + objeto)
- Responsável (se mencionado)
- Prazo (se mencionado)
- Prioridade (alta/média/baixa)
- Módulo relacionado (finances/health/career/routine/etc)`,
  requiredVars: ['text'],
});

registerPattern({
  id: 'universal/weekly-review',
  name: 'Revisão Semanal',
  description: 'Template para revisão semanal completa',
  module: 'universal',
  template: `Faz uma revisão semanal completa baseada nestes dados:

{{week_data}}

Estrutura:
## Conquistas
- O que foi completado esta semana

## Números
- Métricas chave (gastos, treinos, horas produtivas, etc.)

## Padrões
- O que funcionou bem
- O que não funcionou

## Próxima Semana
- Top 3 prioridades
- 1 hábito para melhorar

Mantém conciso: máximo 400 palavras.`,
  requiredVars: ['week_data'],
});
