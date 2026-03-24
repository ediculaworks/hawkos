-- Seed: Phase 4 — CRM, Carreira, Jurídico

-- Pessoas de exemplo (atualize com seus contatos)
-- INSERT INTO people (name, relationship, role, importance, contact_frequency) VALUES
--   ('Exemplo', 'family', 'parent', 10, 'weekly');

-- Workspaces de exemplo (atualize com seus workspaces)
-- INSERT INTO workspaces (name, type, active) VALUES
--   ('Meu Emprego', 'employment', true),
--   ('Minha Empresa', 'company', true);

-- Entidades jurídicas de exemplo (atualize com suas entidades)
-- INSERT INTO legal_entities (name, type, active) VALUES
--   ('Pessoa Física (CPF)', 'cpf', true);

-- Habilitar módulos da Fase 4
UPDATE modules SET enabled = true
WHERE id IN ('people', 'career', 'legal');
