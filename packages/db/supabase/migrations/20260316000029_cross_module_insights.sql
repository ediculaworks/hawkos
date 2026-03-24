-- Cross-module insights (AI-generated correlations between modules)
BEGIN;

CREATE TABLE cross_module_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight TEXT NOT NULL,
  modules TEXT[] NOT NULL,
  confidence REAL DEFAULT 0.5 CHECK (confidence BETWEEN 0.0 AND 1.0),
  evidence JSONB DEFAULT '{}',
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insights_active ON cross_module_insights(created_at DESC) WHERE dismissed = false;

ALTER TABLE cross_module_insights ENABLE ROW LEVEL SECURITY;

COMMIT;
