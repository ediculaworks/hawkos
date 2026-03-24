-- Seed: Phase 2 — Hábitos e Objetivos de exemplo
-- + Habilitar módulos routine, journal, objectives

-- Hábitos de exemplo (atualize com seus hábitos)
INSERT INTO habits (name, description, frequency, module, icon) VALUES
  ('Exercício', 'Atividade física regular', 'weekly_3x', 'health', '🏋️'),
  ('Registro de gastos', 'Registrar todo gasto do dia', 'daily', 'finances', '💰'),
  ('Journaling', 'Escrever no diário', 'daily', 'journal', '📓'),
  ('Leitura 30min', 'Ler livro ou artigo', 'daily', 'knowledge', '📚'),
  ('Dormir antes das 00h', 'Estar na cama antes de meia-noite', 'daily', 'health', '😴');

-- Objetivos de exemplo (atualize com seus objetivos)
INSERT INTO objectives (title, description, timeframe, module, priority) VALUES
  ('Construir reserva de emergência', '6 meses de despesas básicas guardados', 'short', 'finances', 8),
  ('Estabelecer rotina de exercícios', 'Consistência por 3 meses seguidos', 'short', 'health', 7);

-- Objetivos: médio prazo (1-3 anos)
INSERT INTO objectives (title, description, timeframe, module, priority) VALUES
  ('Aumentar renda mensal', 'Diversificar fontes de renda', 'medium', 'finances', 9);

-- Objetivos: longo prazo (3+ anos)
INSERT INTO objectives (title, description, timeframe, module, priority) VALUES
  ('Independência financeira', 'Patrimônio gerando renda passiva suficiente', 'long', 'finances', 10);

-- Habilitar módulos da Fase 2
UPDATE modules SET enabled = true
WHERE id IN ('routine', 'journal', 'objectives');
