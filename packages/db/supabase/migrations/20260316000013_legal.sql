-- Migration: Legal / Jurídico
-- Módulo: legal

CREATE TABLE legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cpf', 'mei', 'ltda', 'sa')),
  document TEXT UNIQUE,              -- CPF ou CNPJ formatado
  active BOOLEAN DEFAULT true,
  registration_date DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE legal_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                -- 'IRPF', 'DAS MEI', 'DEFIS', 'DASN'
  type TEXT NOT NULL CHECK (type IN ('tax', 'declaration', 'renewal', 'payment')),
  frequency TEXT CHECK (frequency IN ('monthly', 'annual', 'quarterly', 'one_time')),
  due_date DATE NOT NULL,
  amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'late', 'exempted')),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  parties TEXT[] DEFAULT '{}',       -- nomes das partes
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('employment', 'service', 'rental', 'partnership', 'other')),
  start_date DATE,
  end_date DATE,
  value DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'draft')),
  file_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Índices
CREATE INDEX idx_obligations_status ON legal_obligations(status) WHERE status = 'pending';
CREATE INDEX idx_obligations_due_date ON legal_obligations(due_date) WHERE status = 'pending';
CREATE INDEX idx_contracts_status ON contracts(status) WHERE status = 'active';
CREATE INDEX idx_contracts_end_date ON contracts(end_date) WHERE end_date IS NOT NULL;
