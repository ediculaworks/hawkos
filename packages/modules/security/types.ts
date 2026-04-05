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

export type CreateSecurityItemInput = {
  name: string;
  type: SecurityCategory;
  status?: SecurityStatus;
  notes?: string;
  next_review?: string;
  metadata?: Record<string, unknown>;
};

export type SecurityAuditLog = {
  id: string;
  item_id: string;
  action: string;
  old_status: SecurityStatus | null;
  new_status: SecurityStatus | null;
  notes: string | null;
  created_at: string;
};
