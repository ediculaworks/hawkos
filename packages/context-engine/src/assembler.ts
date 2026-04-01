import type { ModuleId } from '@hawk/shared';
import { areCentroidsReady, scoreByEmbedding } from './module-embeddings.ts';
import type { AssembledContext, ContextModule, ModuleRelevance } from './types.ts';

const registry = new Map<ModuleId, ContextModule>();

export function registerModule(mod: ContextModule): void {
  registry.set(mod.id, mod);
}

// Token budget limits (in characters, ~4 chars per token)
const L0_MAX_CHARS = 2000; // ~500 tokens
const L1_MAX_CHARS = 8000; // ~2000 tokens
const L2_MAX_CHARS = 12000; // ~3000 tokens

export async function assembleContext(message: string): Promise<AssembledContext> {
  const relevanceScores = await detectRelevantModules(message);
  const relevantModules = relevanceScores.map((r) => r.id);

  // L0: only relevant modules (saves ~2-3k tokens vs loading all 16)
  const l0Parts = relevanceScores
    .map((r) => registry.get(r.id))
    .filter((mod): mod is ContextModule => mod !== undefined)
    .map((mod) => mod.getL0());
  const l0 = l0Parts.join('\n').slice(0, L0_MAX_CHARS);

  // L1: apenas módulos relevantes (sorted by score)
  const l1Parts = await Promise.all(
    relevanceScores
      .map((r) => registry.get(r.id))
      .filter((mod): mod is ContextModule => mod !== undefined)
      .map((mod) => mod.getL1()),
  );
  const l1 = l1Parts.join('\n\n').slice(0, L1_MAX_CHARS);

  // L2: primeiro módulo relevante com query específica
  let l2 = '';
  const primaryModule = relevantModules[0] ? registry.get(relevantModules[0]) : undefined;
  if (primaryModule && requiresSpecificData(message)) {
    l2 = (await primaryModule.getL2(message)).slice(0, L2_MAX_CHARS);
  }

  return { l0, l1, l2, modulesLoaded: relevantModules, relevanceScores };
}

// ── Hybrid Module Detection (Keywords + Embeddings) ──────

// Weight blend: how much each signal contributes to final score
const KEYWORD_WEIGHT = 0.4;
const EMBEDDING_WEIGHT = 0.6;

const moduleKeywords: Record<ModuleId, string[]> = {
  finances: [
    'gasto', 'gastei', 'receita', 'dinheiro', 'saldo', 'dívida', 'pagar', 'paguei', 'comprar',
    'comprei', 'custo', 'r$', 'fatura', 'conta', 'investimento', 'cartão', 'transferência',
    'orçamento', 'budget', 'despesa', 'salário', 'renda', 'extrato', 'banco', 'pix', 'boleto',
  ],
  health: [
    'saúde', 'treino', 'treinei', 'academia', 'humor', 'sono', 'dormi', 'remédio', 'peso',
    'cannabis', 'cigarro', 'corrida', 'corri', 'exercício', 'médico', 'consulta médica',
    'calorias', 'dieta', 'alimentação', 'dor', 'cansado', 'energia', 'musculação',
  ],
  people: [
    'pessoa', 'contato', 'ligou', 'mensagem', 'encontrei', 'aniversário',
    'amigo', 'família', 'colega', 'namorada', 'namorado', 'reunião com',
    'falei com', 'conversei', 'relacionamento',
  ],
  career: [
    'trabalho', 'empresa', 'emprego', 'projeto', 'horas', 'freelance',
    'cliente', 'reunião', 'sprint', 'deadline', 'entrega', 'produtividade',
    'promoção', 'carreira', 'currículo',
  ],
  objectives: [
    'objetivo', 'meta', 'tarefa', 'progresso', 'concluir', 'completar',
    'prazo', 'milestone', 'okr', 'kpi', 'resultado',
  ],
  knowledge: ['nota', 'insight', 'referência', 'livro', 'aprendi', 'wiki', 'artigo', 'documentação'],
  routine: ['hábito', 'streak', 'rotina', 'todos os dias', 'diariamente', 'meditação', 'checklist'],
  assets: ['bem', 'documento', 'patrimônio', 'ativo', 'carro', 'imóvel', 'garantia'],
  entertainment: [
    'filme', 'série', 'música', 'skate', 'lazer', 'jogo', 'podcast',
    'netflix', 'spotify', 'assistir', 'ouvir', 'jogar',
  ],
  legal: [
    'imposto', 'cnpj', 'das', 'irpf', 'contrato', 'prazo',
    'obrigação', 'declaração', 'receita federal', 'mei', 'nota fiscal',
  ],
  social: ['post', 'instagram', 'linkedin', 'twitter', 'rede social', 'publicar'],
  spirituality: ['reflexão', 'gratidão', 'valores', 'meditação', 'propósito', 'mindfulness'],
  housing: [
    'aluguel', 'casa', 'conta de', 'moradia', 'apartamento', 'condomínio',
    'luz', 'água', 'internet', 'reforma',
  ],
  security: ['senha', 'backup', '2fa', 'segurança', 'autenticação', 'vazamento', 'vpn'],
  calendar: [
    'agenda', 'evento', 'amanhã', 'semana', 'compromisso', 'consulta',
    'reunião', 'lembrar', 'lembrete', 'horário', 'data', 'próxima semana',
  ],
  journal: ['diário', 'hoje foi', 'dia foi', 'registrar', 'anotação do dia', 'reflexão do dia'],
};

/**
 * Keyword-based scoring (fast, deterministic, good for exact patterns like "R$").
 */
function scoreByKeywords(message: string): ModuleRelevance[] {
  const lower = message.toLowerCase();
  const scored: ModuleRelevance[] = [];

  for (const [moduleId, keywords] of Object.entries(moduleKeywords)) {
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount > 0) {
      scored.push({
        id: moduleId as ModuleId,
        score: matchCount / keywords.length,
      });
    }
  }

  return scored;
}

/**
 * Hybrid module detection: combines keyword matching (fast, exact) with
 * embedding similarity (semantic, robust to synonyms).
 *
 * When embeddings are available:
 *   final_score = keyword_score × 0.4 + embedding_score × 0.6
 *
 * Falls back to keywords-only if embeddings aren't initialized.
 */
async function detectRelevantModules(message: string): Promise<ModuleRelevance[]> {
  const keywordScores = scoreByKeywords(message);

  // If centroids not ready, fall back to keywords only
  if (!areCentroidsReady()) {
    return keywordScores.sort((a, b) => b.score - a.score);
  }

  // Get embedding scores
  const embeddingScores = await scoreByEmbedding(message, 0.3).catch(() => []);

  if (embeddingScores.length === 0) {
    return keywordScores.sort((a, b) => b.score - a.score);
  }

  // Merge scores: build map of moduleId → blended score
  const scoreMap = new Map<ModuleId, number>();

  for (const { id, score } of keywordScores) {
    scoreMap.set(id, (scoreMap.get(id) ?? 0) + score * KEYWORD_WEIGHT);
  }

  for (const { id, score } of embeddingScores) {
    scoreMap.set(id, (scoreMap.get(id) ?? 0) + score * EMBEDDING_WEIGHT);
  }

  // Convert to sorted array
  const merged: ModuleRelevance[] = [...scoreMap.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);

  return merged;
}

function requiresSpecificData(message: string): boolean {
  const specificPatterns = [
    /quanto gastei/i,
    /quanto tenho/i,
    /qual.*saldo/i,
    /últimas.*transações/i,
    /histórico/i,
    /relatório/i,
    /\d{1,2}\/\d{1,2}/, // data específica
    /janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i,
    // Extended patterns for other modules
    /última.*vez/i,
    /resumo/i,
    /quando foi/i,
    /próximo.*compromisso/i,
    /meu.*objetivo/i,
    /minha.*meta/i,
    /status.*projeto/i,
    /progresso/i,
    /dormi.*quantas/i,
    /minhas.*memórias/i,
    /lista.*de/i,
  ];
  return specificPatterns.some((pattern) => pattern.test(message));
}
