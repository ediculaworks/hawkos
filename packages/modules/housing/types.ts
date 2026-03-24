// Types: Housing / Moradia

export type ResidenceType = 'rented' | 'owned' | 'family';
export type BillStatus = 'pending' | 'paid' | 'overdue';
export type MaintenanceCategory =
  | 'eletrica'
  | 'hidraulica'
  | 'pintura'
  | 'limpeza'
  | 'reforma'
  | 'outros';

export type Residence = {
  id: string;
  name: string;
  address: string | null;
  type: ResidenceType;
  rent: number | null;
  rent_due_day: number | null;
  is_primary: boolean;
  active: boolean;
  metadata: Record<string, unknown>;
};

export type HousingBill = {
  id: string;
  residence_id: string;
  name: string;
  amount: number | null;
  due_day: number | null;
  status: BillStatus;
  reference_month: string | null;
  paid_at: string | null;
  auto_debit: boolean;
  active: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type MaintenanceLog = {
  id: string;
  residence_id: string | null;
  description: string;
  category: MaintenanceCategory | null;
  cost: number | null;
  date: string;
  done_at: string | null;
  next_due_at: string | null;
  notes: string | null;
};

export type CreateBillInput = {
  residence_id: string;
  name: string;
  amount: number;
  due_day: number;
};

export type CreateMaintenanceInput = {
  residence_id: string;
  description: string;
  category?: MaintenanceCategory;
  cost?: number;
  date?: string;
  next_due_at?: string;
  notes?: string;
};

export type UpdateBillInput = {
  name?: string;
  amount?: number;
  due_day?: number;
  notes?: string;
  status?: BillStatus;
};

export type UpdateMaintenanceInput = {
  description?: string;
  category?: MaintenanceCategory;
  cost?: number;
  notes?: string;
  date?: string;
};
