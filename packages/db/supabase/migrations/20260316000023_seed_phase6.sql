-- Seed: Phase 6 — Entertainment + Social + Spirituality

-- Valores pessoais de exemplo (atualize com seus valores)
INSERT INTO personal_values (name, description, priority) VALUES
  ('Saúde',        'Física, mental e emocional — base de tudo', 10),
  ('Família',      'Conexão e presença com quem importa', 9),
  ('Crescimento',  'Aprendizado contínuo e evolução pessoal', 9),
  ('Liberdade',    'Autonomia financeira, de tempo e pensamento', 8),
  ('Impacto',      'Deixar algo melhor do que encontrei', 8),
  ('Criatividade', 'Expressão autêntica e inovação', 7),
  ('Honestidade',  'Ser verdadeiro comigo e com os outros', 7)
ON CONFLICT (name) DO NOTHING;

-- Mídias iniciais (watchlist)
INSERT INTO media_items (title, type, status, platform) VALUES
  ('Interstellar',          'movie',   'want',      NULL),
  ('Breaking Bad',          'series',  'completed', 'Netflix'),
  ('The Dark Knight',       'movie',   'completed', NULL)
ON CONFLICT DO NOTHING;

-- Ativar módulos Phase 6 no banco
UPDATE modules
SET enabled = true
WHERE id IN ('entertainment', 'social', 'spirituality');
