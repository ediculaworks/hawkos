-- =============================================================================
-- Migration: Onboarding Questions + Data Gaps
-- Sistema de perguntas de aprofundamento para onboarding
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. TABELA: Perguntas de onboarding/aprofundamento
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS onboarding_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block TEXT NOT NULL,              -- health, finances, relationships, career, lifestyle, psychology, dynamic
  question_key TEXT NOT NULL UNIQUE, -- '1.1', '2.3', 'dyn_001', etc.
  question TEXT NOT NULL,
  reason TEXT,                       -- por que essa pergunta importa
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'asked', 'answered', 'skipped', 'deferred')),
  asked_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  answer_summary TEXT,
  session_id UUID,                   -- sessão de conversa onde foi perguntada
  modules_affected TEXT[],           -- quais módulos se beneficiam da resposta
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_onboarding_questions_status ON onboarding_questions(status, priority DESC);
CREATE INDEX idx_onboarding_questions_block ON onboarding_questions(block);

ALTER TABLE onboarding_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage onboarding questions" ON onboarding_questions FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. TABELA: Data Gaps detectados automaticamente
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS data_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  table_name TEXT NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('missing', 'shallow', 'stale', 'contradictory')),
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  question_id UUID REFERENCES onboarding_questions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_data_gaps_module ON data_gaps(module, resolved);
CREATE INDEX idx_data_gaps_severity ON data_gaps(severity) WHERE resolved = false;

ALTER TABLE data_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage data gaps" ON data_gaps FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. SEED: Perguntas de onboarding (exemplos genéricos)
-- ═══════════════════════════════════════════════════════════════════════

-- BLOCO 1: Saúde (CRÍTICO — prioridade 9-10)
INSERT INTO onboarding_questions (block, question_key, question, reason, priority, modules_affected) VALUES
  ('health', '1.1',
   'Você tem alguma condição de saúde diagnosticada? Quais?',
   'Necessário para personalizar acompanhamento e correlações.',
   9, ARRAY['health']),
  ('health', '1.2',
   'Como está sua saúde mental atualmente? Algum acompanhamento?',
   'Necessário para avaliar necessidade de suporte e adaptar rotinas.',
   10, ARRAY['health']),
  ('health', '1.3',
   'Quais são seus principais hábitos de saúde (exercício, sono, alimentação)?',
   'Necessário para plano de bem-estar personalizado.',
   9, ARRAY['health']);

-- BLOCO 2: Finanças (CRÍTICO — prioridade 9-10)
INSERT INTO onboarding_questions (block, question_key, question, reason, priority, modules_affected) VALUES
  ('finances', '2.1',
   'Quais são suas despesas fixas mensais detalhadas (aluguel, luz, internet, celular, etc)?',
   'Necessário para criar orçamento real e identificar oportunidades de economia.',
   10, ARRAY['finances', 'housing']),
  ('finances', '2.2',
   'Quanto você ganha por mês? (é fixo ou variável? melhor e pior mês?)',
   'Necessário para projeção financeira precisa.',
   10, ARRAY['finances', 'career']),
  ('finances', '2.3',
   'Você tem outras fontes de renda além do emprego principal?',
   'Necessário para visão completa do fluxo de caixa.',
   9, ARRAY['finances', 'career']);

-- BLOCO 3: Relacionamentos (MÉDIO — prioridade 7)
INSERT INTO onboarding_questions (block, question_key, question, reason, priority, modules_affected) VALUES
  ('relationships', '3.1',
   'Quem são as pessoas mais importantes na sua vida? Como está a frequência de contato?',
   'Necessário para configurar CRM pessoal e lembretes de contato.',
   7, ARRAY['people']),
  ('relationships', '3.2',
   'Você tem uma rede de suporte (amigos próximos, família, mentores)?',
   'Necessário para avaliar rede de suporte e identificar gaps.',
   7, ARRAY['people']),
  ('relationships', '3.3',
   'Quais relacionamentos você gostaria de fortalecer?',
   'Necessário para priorizar ações no módulo de pessoas.',
   6, ARRAY['people']);

-- BLOCO 4: Projetos e Carreira (MÉDIO — prioridade 7)
INSERT INTO onboarding_questions (block, question_key, question, reason, priority, modules_affected) VALUES
  ('career', '4.1',
   'Como você distribui seu tempo entre trabalho, projetos pessoais e descanso?',
   'Necessário para avaliar equilíbrio e viabilidade de metas.',
   7, ARRAY['career']),
  ('career', '4.2',
   'Quais são seus projetos paralelos ou side projects ativos?',
   'Necessário para acompanhar progresso e priorizar esforço.',
   8, ARRAY['career', 'people']),
  ('career', '4.3',
   'Onde você quer estar profissionalmente em 1, 3 e 5 anos?',
   'Necessário para definir metas e acompanhar progresso.',
   6, ARRAY['career', 'finances']);

-- BLOCO 5: Hábitos e Lifestyle (BAIXO — prioridade 5)
INSERT INTO onboarding_questions (block, question_key, question, reason, priority, modules_affected) VALUES
  ('lifestyle', '5.1',
   'Qual é sua rotina matinal típica (do acordar ao trabalho)?',
   'Menciona "irregular" sem detalhar. Necessário para identificar pontos de melhoria.',
   5, ARRAY['routine', 'health']),
  ('lifestyle', '5.2',
   'O que você faz quando não está trabalhando? (fim de semana típico)',
   'Lista hobbies mas sem frequência. Necessário para avaliar qualidade de vida.',
   5, ARRAY['routine', 'entertainment']),
  ('lifestyle', '5.3',
   'Você tem algum ritual antes de dormir?',
   'Sono irregular (00h-1h). Necessário para melhorar higiene do sono.',
   6, ARRAY['routine', 'health']);

-- BLOCO 6: Psicologia e Motivação (AVANÇADO — prioridade 6)
INSERT INTO onboarding_questions (block, question_key, question, reason, priority, modules_affected) VALUES
  ('psychology', '6.1',
   'O que te faz acordar de manhã com propósito?',
   'Necessário para encontrar motivação diária e alinhar rotina.',
   6, ARRAY['journal', 'objectives']),
  ('psychology', '6.2',
   'Quando foi a última vez que você se sentiu verdadeiramente feliz? O que estava acontecendo?',
   'Necessário para entender fatores de felicidade e bem-estar.',
   6, ARRAY['journal', 'health']),
  ('psychology', '6.3',
   'Se você pudesse mudar uma coisa na sua vida HOJE, o que seria?',
   'Necessário para identificar próxima ação prioritária.',
   7, ARRAY['objectives']);

COMMIT;
