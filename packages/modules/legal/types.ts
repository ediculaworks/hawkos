// Types: Legal / Jurídico

export type LegalEntityType = 'cpf' | 'mei' | 'ltda' | 'sa';
export type ObligationType = 'tax' | 'declaration' | 'renewal' | 'payment';
export type ObligationFrequency = 'monthly' | 'annual' | 'quarterly' | 'one_time';
export type ObligationStatus = 'pending' | 'completed' | 'late' | 'exempted';
export type ContractType = 'employment' | 'service' | 'rental' | 'partnership' | 'other';
export type ContractStatus = 'active' | 'expired' | 'terminated' | 'draft';

export type LegalEntity = {
  id: string;
  name: string;
  type: LegalEntityType;
  document: string | null;
  active: boolean;
  registration_date: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type LegalObligation = {
  id: string;
  entity_id: string | null;
  name: string;
  type: ObligationType;
  frequency: ObligationFrequency | null;
  due_date: string; // YYYY-MM-DD
  amount: number | null;
  status: ObligationStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Contract = {
  id: string;
  title: string;
  parties: string[];
  entity_id: string | null;
  type: ContractType | null;
  start_date: string | null;
  end_date: string | null;
  value: number | null;
  status: ContractStatus;
  file_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type ObligationWithDaysLeft = LegalObligation & {
  days_until_due: number;
  urgency: 'critical' | 'urgent' | 'warning' | 'ok';
};

// ── Input types ──────────────────────────────────────────────

export type CreateObligationInput = {
  name: string;
  type: ObligationType;
  due_date: string; // YYYY-MM-DD
  frequency?: ObligationFrequency;
  amount?: number;
  notes?: string;
  entity_id?: string;
};

export type UpdateObligationInput = {
  name?: string;
  type?: ObligationType;
  due_date?: string;
  frequency?: ObligationFrequency;
  amount?: number;
  status?: ObligationStatus;
  notes?: string;
};

export type CreateContractInput = {
  title: string;
  parties?: string[];
  entity_id?: string;
  type?: ContractType;
  start_date?: string;
  end_date?: string;
  value?: number;
  notes?: string;
};

export type UpdateContractInput = {
  title?: string;
  parties?: string[];
  entity_id?: string;
  type?: ContractType;
  start_date?: string;
  end_date?: string;
  value?: number;
  status?: ContractStatus;
  notes?: string;
};

export type CreateLegalEntityInput = {
  name: string;
  type: LegalEntityType;
  document?: string;
  registration_date?: string;
  notes?: string;
};

export type UpdateLegalEntityInput = {
  name?: string;
  type?: LegalEntityType;
  document?: string;
  registration_date?: string;
  active?: boolean;
  notes?: string;
};
