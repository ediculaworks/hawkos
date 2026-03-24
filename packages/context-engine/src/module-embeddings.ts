import { generateEmbedding } from '@hawk/module-memory/embeddings';
import type { ModuleId } from '@hawk/shared';

/**
 * Module Embedding Classifier
 *
 * Uses centroid-based embedding classification to detect which modules
 * are relevant to a user message. Each module has representative descriptions
 * whose embeddings are averaged into a "centroid" — a single point in
 * 1536-dimensional space representing that module's meaning.
 *
 * When a user sends a message, we compute its embedding and find which
 * module centroids are closest (cosine similarity).
 *
 * This is more robust than keyword matching because it understands
 * synonyms, context, and semantic meaning.
 */

// ── Module Descriptions ────────────────────────────────────
// Rich descriptions per module — these define what each module "means"
// in embedding space. More diverse descriptions = better centroids.

const MODULE_DESCRIPTIONS: Record<ModuleId, string[]> = {
  finances: [
    'Gastos, receitas, saldo bancário, cartão de crédito, investimentos',
    'Quanto gastei este mês em alimentação e restaurantes',
    'Orçamento mensal, categorias de despesas, patrimônio líquido',
    'Transferência entre contas, pagamento de boleto, PIX',
    'Rendimento da carteira, dividendos, ações, FIIs, renda fixa',
  ],
  health: [
    'Saúde física e mental, treino, academia, exercícios, corrida',
    'Qualidade do sono, horas dormidas, insônia, rotina de sono',
    'Humor, energia, ansiedade, estresse, bem-estar emocional',
    'Peso corporal, medidas, percentual de gordura, IMC',
    'Medicamentos, suplementos, cannabis, substâncias, tabaco',
    'Exames laboratoriais, consulta médica, resultados de sangue',
  ],
  people: [
    'Contatos pessoais, amigos, família, colegas de trabalho',
    'Aniversários, datas especiais, lembrar de ligar para alguém',
    'Relacionamentos, network profissional, CRM pessoal',
    'Última vez que falei com alguém, frequência de contato',
    'Conheci uma pessoa nova, interação, encontro, reunião',
  ],
  career: [
    'Trabalho, emprego, carreira profissional, currículo',
    'Projetos freelance, horas trabalhadas, clientes',
    'Entrevista de emprego, promoção, salário, empresa',
    'Skills técnicas, certificações, portfolio, GitHub',
    'Networking profissional, LinkedIn, conferências',
  ],
  objectives: [
    'Metas pessoais, objetivos de vida, OKRs, planejamento',
    'Tarefas pendentes, to-do list, prioridades, prazos',
    'Progresso em projetos, porcentagem concluída, milestones',
    'Objetivos de curto, médio e longo prazo',
    'Projetos pessoais, ideias, planos futuros',
  ],
  knowledge: [
    'Notas pessoais, segundo cérebro, base de conhecimento',
    'Livros lidos, artigos interessantes, aprendizados',
    'Ideias, insights, reflexões intelectuais, pesquisa',
    'Referências, links úteis, documentação, tutoriais',
    'Resumos de conteúdo, anotações de estudo, cursos',
  ],
  routine: [
    'Hábitos diários, rotina matinal, streak de hábitos',
    'Meditação, leitura, exercício diário, água',
    'Produtividade, disciplina, consistência, foco',
    'Checklist diário, conclusão de hábitos, pontuação',
    'Rotina noturna, preparar o dia seguinte, ritual',
  ],
  assets: [
    'Bens pessoais, patrimônio, documentos importantes',
    'Carro, moto, eletrônicos, equipamentos de valor',
    'Garantias, notas fiscais, comprovantes de compra',
    'Inventário de pertences, seguro, avaliação',
  ],
  entertainment: [
    'Filmes, séries, jogos, música, hobbies de lazer',
    'Skate, esportes recreativos, atividades ao ar livre',
    'O que assistir, recomendações, watchlist, playlist',
    'Tempo de lazer, diversão, descanso, entretenimento',
  ],
  legal: [
    'Impostos, IRPF, DAS, CNPJ, obrigações fiscais',
    'Contratos, documentos legais, procurações',
    'Prazos jurídicos, compliance, regulamentações',
    'Empresa, MEI, nota fiscal, obrigações tributárias',
  ],
  social: [
    'Redes sociais, posts, Instagram, LinkedIn, Twitter',
    'Conteúdo para publicar, estratégia de social media',
    'Engajamento, seguidores, analytics de redes sociais',
    'Criação de conteúdo, portfólio online, marca pessoal',
  ],
  spirituality: [
    'Reflexão pessoal, gratidão, valores, propósito de vida',
    'Meditação profunda, mindfulness, autoconhecimento',
    'Práticas espirituais, filosofia de vida, princípios',
    'Crescimento pessoal, evolução interior, equilíbrio',
  ],
  housing: [
    'Casa, apartamento, aluguel, moradia, condomínio',
    'Contas da casa, luz, água, internet, gás',
    'Manutenção, consertos, reformas, mudança',
    'Limpeza, organização doméstica, compras de casa',
  ],
  security: [
    'Senhas, autenticação, 2FA, segurança digital',
    'Backup de dados, criptografia, privacidade',
    'Contas online, credenciais, gerenciador de senhas',
    'Proteção digital, vazamento de dados, auditoria',
  ],
  calendar: [
    'Agenda, compromissos, reuniões, eventos, horários',
    'Marcar consulta, agendar encontro, disponibilidade',
    'Amanhã, próxima semana, hoje, calendário, data',
    'Lembrete, notificação, prazo, deadline, vencimento',
  ],
  journal: [
    'Diário pessoal, como foi meu dia, registro diário',
    'Humor do dia, energia, reflexão sobre o dia',
    'Escrita livre, desabafo, pensamentos do dia',
    'Gratidão diária, conquistas, destaques do dia',
  ],
};

// ── Centroid Cache ──────────────────────────────────────────

type ModuleCentroid = { id: ModuleId; centroid: number[] };

let cachedCentroids: ModuleCentroid[] | null = null;
let centroidsInitialized = false;

/**
 * Compute mean vector (centroid) from multiple embeddings.
 * The centroid represents the "average meaning" of a module.
 */
function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const first = embeddings[0];
  if (!first) return [];
  const dims = first.length;
  const centroid = new Array<number>(dims).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dims; i++) {
      centroid[i] = (centroid[i] ?? 0) + (emb[i] ?? 0);
    }
  }
  for (let i = 0; i < dims; i++) {
    centroid[i] = (centroid[i] ?? 0) / embeddings.length;
  }
  return centroid;
}

/**
 * Cosine similarity between two vectors.
 * Returns value between -1 and 1 (1 = identical direction).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Initialize module centroids by embedding all descriptions.
 * Call once at startup — results are cached in memory.
 * Fails gracefully: if embeddings can't be generated, returns empty.
 */
export async function initModuleCentroids(): Promise<void> {
  if (centroidsInitialized) return;

  try {
    const modules = Object.keys(MODULE_DESCRIPTIONS) as ModuleId[];
    const centroids: ModuleCentroid[] = [];

    // Generate embeddings for all descriptions in parallel (batched per module)
    for (const moduleId of modules) {
      const descriptions = MODULE_DESCRIPTIONS[moduleId];
      if (!descriptions || descriptions.length === 0) continue;

      const embeddings = await Promise.all(
        descriptions.map((desc) => generateEmbedding(desc).catch(() => null)),
      );

      const validEmbeddings = embeddings.filter((e): e is number[] => e !== null);
      if (validEmbeddings.length > 0) {
        centroids.push({ id: moduleId, centroid: computeCentroid(validEmbeddings) });
      }
    }

    cachedCentroids = centroids;
    centroidsInitialized = true;
    // biome-ignore lint/suspicious/noConsole: startup log
    console.log(`[module-embeddings] Initialized ${centroids.length} module centroids`);
  } catch (err) {
    // biome-ignore lint/suspicious/noConsole: error log
    console.error('[module-embeddings] Failed to initialize centroids:', err);
    cachedCentroids = null;
  }
}

/**
 * Score a message against module centroids using embedding similarity.
 * Returns modules sorted by similarity score (highest first).
 *
 * Only returns modules with similarity above the threshold (default 0.3).
 * Returns empty array if centroids haven't been initialized.
 */
export async function scoreByEmbedding(
  message: string,
  threshold = 0.3,
): Promise<Array<{ id: ModuleId; score: number }>> {
  if (!cachedCentroids || cachedCentroids.length === 0) {
    return [];
  }

  let messageEmbedding: number[];
  try {
    messageEmbedding = await generateEmbedding(message);
  } catch {
    return [];
  }

  const scores = cachedCentroids
    .map(({ id, centroid }) => ({
      id,
      score: cosineSimilarity(messageEmbedding, centroid),
    }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score);

  return scores;
}

/**
 * Check if centroids are ready (initialized successfully).
 */
export function areCentroidsReady(): boolean {
  return centroidsInitialized && cachedCentroids !== null && cachedCentroids.length > 0;
}
