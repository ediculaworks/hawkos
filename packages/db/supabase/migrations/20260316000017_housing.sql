-- Migration: Housing / Moradia
-- Módulo: housing

CREATE TABLE residences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,            -- 'Apto BH', 'Apto SP'
  address TEXT,
  type TEXT NOT NULL CHECK (type IN ('rented', 'owned', 'family')),
  rent DECIMAL(10,2),
  rent_due_day INTEGER CHECK (rent_due_day BETWEEN 1 AND 31),
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE housing_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID REFERENCES residences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- 'Conta de Luz', 'Internet', 'Condomínio'
  amount DECIMAL(10,2),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  auto_debit BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID REFERENCES residences(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  cost DECIMAL(10,2),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT
);

-- Índices
CREATE INDEX idx_residences_active ON residences(active) WHERE active = true;
CREATE INDEX idx_housing_bills_active ON housing_bills(active) WHERE active = true;
CREATE INDEX idx_maintenance_date ON maintenance_logs(date DESC);
