-- Migration: Assets / Patrimônio + Documents
-- Módulo: assets

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('electronics', 'vehicle', 'real_estate', 'investment', 'furniture', 'other')),
  value DECIMAL(12,2),
  purchase_date DATE,
  condition TEXT CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  location TEXT,
  insured BOOLEAN DEFAULT false,
  insurance_expiry DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('identity', 'contract', 'tax', 'health', 'property', 'vehicle', 'other')),
  entity TEXT,                   -- owner entity name
  expiry_date DATE,
  file_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Índices
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_insurance_expiry ON assets(insurance_expiry) WHERE insurance_expiry IS NOT NULL;
CREATE INDEX idx_documents_expiry ON documents(expiry_date) WHERE expiry_date IS NOT NULL;
