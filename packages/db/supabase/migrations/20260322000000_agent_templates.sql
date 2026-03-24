-- Agent Templates: templates de agentes customizáveis
BEGIN;

CREATE TABLE IF NOT EXISTS agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_seed TEXT,
  avatar_style TEXT DEFAULT 'pixel',
  avatar_url TEXT,
  personality JSONB DEFAULT '{}'::jsonb,
  identity TEXT,
  knowledge TEXT,
  philosophy TEXT,
  system_prompt TEXT,
  tools_enabled TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  memory_type TEXT DEFAULT 'shared' CHECK (memory_type IN ('shared', 'agent', 'session')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON agent_templates;
CREATE POLICY "Allow public read access"
  ON agent_templates FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON agent_templates;
CREATE POLICY "Allow service role write access"
  ON agent_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Agent Conversations: vincula sessão a um template
CREATE TABLE IF NOT EXISTS agent_conversations (
  session_id TEXT PRIMARY KEY,
  template_id UUID REFERENCES agent_templates(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  context JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON agent_conversations;
CREATE POLICY "Allow public read access"
  ON agent_conversations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON agent_conversations;
CREATE POLICY "Allow service role write access"
  ON agent_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Session Memories: memória temporária por sessão
CREATE TABLE IF NOT EXISTS session_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  template_id UUID REFERENCES agent_templates(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  memory_type TEXT DEFAULT 'session' CHECK (memory_type IN ('session', 'agent', 'universal')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_memories_session ON session_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_session_memories_template ON session_memories(template_id);

ALTER TABLE session_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON session_memories;
CREATE POLICY "Allow public read access"
  ON session_memories FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON session_memories;
CREATE POLICY "Allow service role write access"
  ON session_memories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert Hawk as default system agent
INSERT INTO agent_templates (
  id,
  name,
  description,
  avatar_seed,
  avatar_style,
  personality,
  identity,
  knowledge,
  philosophy,
  system_prompt,
  tools_enabled,
  is_default,
  is_system,
  memory_type
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Hawk',
  'Agente pessoal principal - gestor do sistema',
  'hawk-001',
  'pixel',
  '{"traits": ["inteligente", "prático", "direto"], "tone": "técnico neutro", "phrases": []}'::jsonb,
  'Agente pessoal do usuário. Personalidade e conhecimento carregados dinamicamente via context engine.',
  'Conhecimento sobre o usuário é carregado dinamicamente via módulos e memórias persistentes.',
  'Respostas curtas por padrão. Detalhe apenas quando necessário. Confirme operações de escrita.',
  NULL,
  ARRAY['finances', 'calendar', 'routine', 'journal', 'objectives', 'health', 'people', 'career', 'legal', 'knowledge', 'assets', 'housing', 'security', 'entertainment', 'social', 'spirituality', 'memory'],
  true,
  true,
  'shared'
) ON CONFLICT (id) DO NOTHING;

-- Insert generic assistant as default
INSERT INTO agent_templates (
  name,
  description,
  avatar_seed,
  avatar_style,
  personality,
  identity,
  is_default,
  is_system,
  memory_type
) VALUES (
  'Assistant',
  'Assistente genérico para conversas gerais',
  'assistant-001',
  'pixel',
  '{"traits": ["útil", "amigável"], "tone": "formal", "phrases": []}'::jsonb,
  'Assistente de IA genérico',
  true,
  false,
  'shared'
) ON CONFLICT DO NOTHING;

COMMIT;
