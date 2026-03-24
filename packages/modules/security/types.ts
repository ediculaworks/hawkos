// Types: Security / Segurança Digital e Física

export type SecurityCategory =
  | 'account'
  | 'backup'
  | '2fa'
  | 'recovery'
  | 'password_manager'
  | 'other';
export type SecurityStatus = 'ok' | 'needs_attention' | 'critical';

export type SecurityItem = {
  id: string;
  name: string;
  type: SecurityCategory;
  status: SecurityStatus;
  last_verified: string | null;
  next_review: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type UpdateSecurityItemInput = {
  status?: SecurityStatus;
  notes?: string;
  next_review?: string;
};
