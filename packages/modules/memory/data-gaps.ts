/**
 * Data Gaps Detection + Onboarding Question System
 *
 * Detecta lacunas nos dados do banco e gerencia perguntas de aprofundamento.
 * Integra com daily check-in e tool do agente.
 */

import { db } from '@hawk/db';

// ── Types ────────────────────────────────────────────────────

export type OnboardingQuestion = {
  id: string;
  block: string;
  question_key: string;
  question: string;
  reason: string | null;
  priority: number;
  status: string;
  asked_at: string | null;
  answered_at: string | null;
  answer_summary: string | null;
  modules_affected: string[];
  created_at: string;
};

export type DataGap = {
  module: string;
  table_name: string;
  gap_type: 'missing' | 'shallow' | 'stale';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
};

// ── Gap Detection ────────────────────────────────────────────

/**
 * Detecta lacunas nos dados do banco por módulo.
 * Retorna lista de gaps encontrados.
 */
export async function detectDataGaps(): Promise<DataGap[]> {
  const gaps: DataGap[] = [];

  // People: sem birthday
  const { data: peopleMissingBirthday } = await db
    .from('people')
    .select('name')
    .is('birthday', null)
    .eq('active', true)
    .limit(50);

  for (const p of peopleMissingBirthday ?? []) {
    gaps.push({
      module: 'people',
      table_name: 'people',
      gap_type: 'missing',
      description: `${p.name} não tem data de aniversário registrada`,
      severity: 'medium',
    });
  }

  // People: sem interação em 30+ dias com contact_frequency weekly
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: overdueContacts } = await db
    .from('people')
    .select('name, last_interaction, contact_frequency')
    .eq('active', true)
    .eq('contact_frequency', 'weekly')
    .or(`last_interaction.is.null,last_interaction.lt.${thirtyDaysAgo}`)
    .limit(50);

  for (const p of overdueContacts ?? []) {
    gaps.push({
      module: 'people',
      table_name: 'people',
      gap_type: 'stale',
      description: `${p.name} (contato semanal) sem interação há 30+ dias`,
      severity: 'high',
    });
  }

  // Finances: sem transação no mês atual
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const { count: txCount } = await db
    .from('finance_transactions')
    .select('id', { count: 'exact', head: true })
    .gte('date', firstOfMonth.toISOString().slice(0, 10));

  if ((txCount ?? 0) === 0) {
    gaps.push({
      module: 'finances',
      table_name: 'finance_transactions',
      gap_type: 'missing',
      description: 'Nenhuma transação registrada este mês',
      severity: 'critical',
    });
  }

  // Health: sem body_measurement
  const { count: measureCount } = await db
    .from('body_measurements')
    .select('id', { count: 'exact', head: true });

  if ((measureCount ?? 0) === 0) {
    gaps.push({
      module: 'health',
      table_name: 'body_measurements',
      gap_type: 'missing',
      description: 'Nenhuma medida corporal registrada',
      severity: 'high',
    });
  }

  // Health: condição ativa sem nota recente (30 dias)
  const { data: activeConditions } = await db
    .from('conditions')
    .select('name, status')
    .eq('status', 'active')
    .limit(50);

  for (const c of activeConditions ?? []) {
    gaps.push({
      module: 'health',
      table_name: 'conditions',
      gap_type: 'shallow',
      description: `Condição ativa "${c.name}" — verificar se houve evolução recente`,
      severity: 'medium',
    });
  }

  // Objectives: objetivo sem tasks
  const { data: objectivesNoTasks } = await db
    .from('objectives')
    .select('id, title')
    .eq('status', 'active')
    .limit(50);

  for (const obj of objectivesNoTasks ?? []) {
    const { count: taskCount } = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('objective_id', obj.id);

    if ((taskCount ?? 0) === 0) {
      gaps.push({
        module: 'objectives',
        table_name: 'objectives',
        gap_type: 'shallow',
        description: `Objetivo "${obj.title}" não tem tarefas associadas`,
        severity: 'high',
      });
    }
  }

  // Journal: sem entry em 7 dias
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { count: journalCount } = await db
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .gte('date', sevenDaysAgo);

  if ((journalCount ?? 0) === 0) {
    gaps.push({
      module: 'journal',
      table_name: 'journal_entries',
      gap_type: 'stale',
      description: 'Nenhuma entrada no diário nos últimos 7 dias',
      severity: 'medium',
    });
  }

  return gaps;
}

// ── Question Management ──────────────────────────────────────

/**
 * Retorna a próxima pergunta a fazer, priorizando por:
 * 1. Priority DESC
 * 2. Cooldown: não repetir pergunta em 3 dias
 * 3. Se topic fornecido, boost perguntas do mesmo bloco
 */
export async function getNextQuestion(topic?: string): Promise<OnboardingQuestion | null> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const query = db
    .from('onboarding_questions')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .limit(10);

  const { data, error } = await query;
  if (error || !data?.length) return null;

  // Filter out recently asked (cooldown 3 days)
  const candidates = (data as OnboardingQuestion[]).filter(
    (q) => !q.asked_at || new Date(q.asked_at) < new Date(threeDaysAgo),
  );

  if (!candidates.length) return null;

  // If topic provided, prefer questions from matching block
  if (topic) {
    const topicMap: Record<string, string[]> = {
      health: ['health'],
      saude: ['health'],
      finances: ['finances'],
      financeiro: ['finances'],
      dinheiro: ['finances'],
      pessoas: ['relationships'],
      relacionamento: ['relationships'],
      carreira: ['career'],
      trabalho: ['career'],
      habitos: ['lifestyle'],
      rotina: ['lifestyle'],
      psicologia: ['psychology'],
      motivacao: ['psychology'],
    };

    const matchBlocks = topicMap[topic.toLowerCase()] ?? [];
    const topicMatch = candidates.find((q) => matchBlocks.includes(q.block));
    if (topicMatch) return topicMatch;
  }

  return candidates[0] ?? null;
}

/**
 * Marca pergunta como "asked" (enviada ao usuário)
 */
export async function markQuestionAsked(questionId: string): Promise<void> {
  await db
    .from('onboarding_questions')
    .update({ status: 'asked', asked_at: new Date().toISOString() })
    .eq('id', questionId);
}

/**
 * Marca pergunta como respondida com resumo da resposta
 */
export async function markQuestionAnswered(
  questionId: string,
  answerSummary: string,
): Promise<void> {
  await db
    .from('onboarding_questions')
    .update({
      status: 'answered',
      answered_at: new Date().toISOString(),
      answer_summary: answerSummary,
    })
    .eq('id', questionId);

  // Resolve related data gaps
  await db
    .from('data_gaps')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('question_id', questionId);
}

/**
 * Insere uma pergunta dinâmica gerada pelo LLM
 */
export async function insertDynamicQuestion(
  question: string,
  reason: string,
  priority: number,
  modulesAffected: string[],
): Promise<OnboardingQuestion> {
  // Generate unique key for dynamic questions
  const { count } = await db
    .from('onboarding_questions')
    .select('id', { count: 'exact', head: true })
    .like('question_key', 'dyn_%');

  const key = `dyn_${String((count ?? 0) + 1).padStart(3, '0')}`;

  const { data, error } = await db
    .from('onboarding_questions')
    .insert({
      block: 'dynamic',
      question_key: key,
      question,
      reason,
      priority,
      modules_affected: modulesAffected,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert dynamic question: ${error.message}`);
  return data as unknown as OnboardingQuestion;
}

/**
 * Persiste gaps detectados no banco, associando a perguntas quando possível
 */
export async function persistDataGaps(gaps: DataGap[]): Promise<number> {
  if (!gaps.length) return 0;

  const rows = gaps.map((g) => ({
    module: g.module,
    table_name: g.table_name,
    gap_type: g.gap_type,
    description: g.description,
    severity: g.severity,
  }));

  const { error } = await db.from('data_gaps').insert(rows);
  if (error) throw new Error(`Failed to persist data gaps: ${error.message}`);
  return gaps.length;
}

/**
 * Retorna estatísticas do sistema de perguntas
 */
export async function getQuestionStats(): Promise<{
  total: number;
  pending: number;
  asked: number;
  answered: number;
}> {
  const { count: total } = await db
    .from('onboarding_questions')
    .select('id', { count: 'exact', head: true });

  const { count: pending } = await db
    .from('onboarding_questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: asked } = await db
    .from('onboarding_questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'asked');

  const { count: answered } = await db
    .from('onboarding_questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'answered');

  return {
    total: total ?? 0,
    pending: pending ?? 0,
    asked: asked ?? 0,
    answered: answered ?? 0,
  };
}
