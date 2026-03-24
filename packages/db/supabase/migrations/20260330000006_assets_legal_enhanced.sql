-- Migration: Assets/Legal — Documents OCR + Contract Lifecycle
-- Referências: docs/repositorios/paperless-ngx.md, docs/repositorios/documenso.md
-- Tasks: I1.9.1–7

BEGIN;

-- ============================================================
-- DOCUMENTS — OCR + Full-text Search (Paperless-ngx pattern)
-- ============================================================

-- Adicionar colunas para OCR e metadados ricos
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS content TEXT,                     -- texto extraído via OCR
  ADD COLUMN IF NOT EXISTS checksum TEXT,                    -- SHA256 para deduplicação
  ADD COLUMN IF NOT EXISTS correspondent_id UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type_id UUID,            -- FK adicionada abaixo
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_serial TEXT,              -- número único: DOC-2026-001
  ADD COLUMN IF NOT EXISTS page_count INT,
  ADD COLUMN IF NOT EXISTS file_size_bytes INT,
  ADD COLUMN IF NOT EXISTS document_date DATE,               -- data do documento (vs data de upload)
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Full-text search index no conteúdo OCR + nome
CREATE INDEX IF NOT EXISTS idx_documents_fts ON documents
  USING gin(to_tsvector('portuguese',
    coalesce(name, '') || ' ' || coalesce(content, '')
  ));

CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents(checksum) WHERE checksum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_correspondent ON documents(correspondent_id) WHERE correspondent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_archived ON documents(is_archived, created_at DESC);

-- Tipos de documento personalizados (Paperless-ngx pattern)
CREATE TABLE IF NOT EXISTS document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                  -- 'RG', 'Contrato', 'Nota Fiscal', 'Extrato', 'Certidão'
  color TEXT DEFAULT '#6b7280',
  matching_pattern TEXT,               -- regex para auto-classificação
  is_system BOOLEAN DEFAULT false,     -- tipos default do sistema
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir FK após criar tabela
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_type FOREIGN KEY (document_type_id)
  REFERENCES document_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type_id) WHERE document_type_id IS NOT NULL;

ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage document types" ON document_types FOR ALL USING (true) WITH CHECK (true);

-- Regras de arquivamento automático
CREATE TABLE IF NOT EXISTS archiving_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '{}',   -- { "name_contains": "NF", "type": "tax" }
  actions JSONB NOT NULL DEFAULT '{}',      -- { "set_tags": ["fiscal"], "set_type": "tax", "archive": false }
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archiving_rules_active ON archiving_rules(is_active, priority);

ALTER TABLE archiving_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage archiving rules" ON archiving_rules FOR ALL USING (true) WITH CHECK (true);

-- Fila de processamento OCR
CREATE TABLE IF NOT EXISTS document_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tasks TEXT[] NOT NULL DEFAULT '{"ocr"}',  -- ['ocr', 'classify', 'apply_rules']
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doc_queue_pending ON document_processing_queue(status, created_at) WHERE status = 'pending';

ALTER TABLE document_processing_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage document queue" ON document_processing_queue FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: Tipos de documento padrão
-- ============================================================

INSERT INTO document_types (name, color, is_system) VALUES
  ('RG / CNH',             '#3b82f6', true),
  ('CPF / CNPJ',           '#6366f1', true),
  ('Certidão',             '#8b5cf6', true),
  ('Contrato',             '#f59e0b', true),
  ('Nota Fiscal',          '#10b981', true),
  ('Extrato Bancário',     '#06b6d4', true),
  ('Comprovante',          '#84cc16', true),
  ('Apólice de Seguro',    '#f97316', true),
  ('Escritura / IPTU',     '#ef4444', true),
  ('Laudo Médico',         '#ec4899', true),
  ('Currículo / Diploma',  '#a78bfa', true),
  ('Outro',                '#9ca3af', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CONTRACTS — Lifecycle Completo (Documenso pattern)
-- ============================================================

-- Adicionar campos de ciclo de vida a contracts
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS signing_status TEXT DEFAULT 'not_required'
    CHECK (signing_status IN (
      'not_required', 'draft', 'pending_signature', 'signed', 'declined', 'expired'
    )),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,                  -- data de vencimento explícita
  ADD COLUMN IF NOT EXISTS renewal_date DATE,                 -- quando renovar
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_notice_days INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Migrar end_date → expiry_date onde expiry_date é NULL
UPDATE contracts SET expiry_date = end_date WHERE expiry_date IS NULL AND end_date IS NOT NULL;

-- Índices de vencimento para alertas
CREATE INDEX IF NOT EXISTS idx_contracts_expiry ON contracts(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_renewal ON contracts(renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_signing ON contracts(signing_status);

-- Signatários do contrato
CREATE TABLE IF NOT EXISTS contract_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'signer' CHECK (role IN ('signer', 'approver', 'witness', 'cc')),
  signing_order INT DEFAULT 1,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_signatories_contract ON contract_signatories(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatories_person ON contract_signatories(person_id) WHERE person_id IS NOT NULL;

ALTER TABLE contract_signatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage contract signatories" ON contract_signatories FOR ALL USING (true) WITH CHECK (true);

-- Audit log de contratos
CREATE TABLE IF NOT EXISTS contract_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'sent', 'viewed', 'signed', 'declined', 'completed',
    'expired', 'renewed', 'reminder_sent', 'archived'
  )),
  actor TEXT DEFAULT 'system',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_audit_contract ON contract_audit_log(contract_id, created_at DESC);

ALTER TABLE contract_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage contract audit" ON contract_audit_log FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at em documents
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

COMMIT;
