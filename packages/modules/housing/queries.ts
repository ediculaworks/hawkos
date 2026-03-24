import { db } from '@hawk/db';
import type {
  CreateBillInput,
  CreateMaintenanceInput,
  HousingBill,
  MaintenanceLog,
  Residence,
  UpdateBillInput,
  UpdateMaintenanceInput,
} from './types';

export async function listResidences(): Promise<Residence[]> {
  const { data, error } = await db.from('residences').select('*').eq('active', true);
  if (error) throw new Error(`Failed to list residences: ${error.message}`);
  return (data ?? []) as Residence[];
}

export async function getPrimaryResidence(): Promise<Residence | null> {
  const { data, error } = await db
    .from('residences')
    .select('*')
    .eq('active', true)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to get primary residence: ${error.message}`);
  return data as Residence | null;
}

export async function createBill(input: CreateBillInput): Promise<HousingBill> {
  const { data, error } = await db
    .from('housing_bills')
    .insert({
      residence_id: input.residence_id,
      name: input.name,
      amount: input.amount,
      due_day: input.due_day,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create bill: ${error.message}`);
  return data as HousingBill;
}

export async function listBills(residenceId?: string): Promise<HousingBill[]> {
  let query = db
    .from('housing_bills')
    .select('*')
    .eq('active', true)
    .order('due_day', { ascending: true });
  if (residenceId) query = query.eq('residence_id', residenceId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list bills: ${error.message}`);
  return (data ?? []) as HousingBill[];
}

export async function markBillPaid(billId: string): Promise<HousingBill> {
  const { data, error } = await db
    .from('housing_bills')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString().split('T')[0] as string | null,
    })
    .eq('id', billId)
    .select()
    .single();
  if (error) throw new Error(`Failed to mark bill as paid: ${error.message}`);
  return data as HousingBill;
}

export async function getPendingBills(): Promise<HousingBill[]> {
  const { data, error } = await db
    .from('housing_bills')
    .select('*')
    .eq('active', true)
    .eq('status', 'pending')
    .order('due_day', { ascending: true });
  if (error) throw new Error(`Failed to get pending bills: ${error.message}`);
  return (data ?? []) as HousingBill[];
}

export async function createMaintenance(input: CreateMaintenanceInput): Promise<MaintenanceLog> {
  const { data, error } = await db
    .from('maintenance_logs')
    .insert({
      residence_id: input.residence_id,
      description: input.description,
      category: input.category ?? null,
      cost: input.cost ?? null,
      date: input.date ?? new Date().toISOString().split('T')[0],
      done_at: input.date ?? new Date().toISOString().split('T')[0],
      next_due_at: input.next_due_at ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create maintenance log: ${error.message}`);
  return data as MaintenanceLog;
}

export async function listMaintenance(residenceId?: string): Promise<MaintenanceLog[]> {
  let query = db.from('maintenance_logs').select('*').order('date', { ascending: false }).limit(10);
  if (residenceId) query = query.eq('residence_id', residenceId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list maintenance: ${error.message}`);
  return (data ?? []) as MaintenanceLog[];
}

export async function getMonthlyBillTotal(): Promise<number> {
  const { data, error } = await db
    .from('housing_bills')
    .select('amount')
    .eq('active', true)
    .eq('status', 'pending');
  if (error) throw new Error(`Failed to get bill total: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0);
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await db.from('housing_bills').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete bill: ${error.message}`);
}

export async function deleteMaintenanceLog(id: string): Promise<void> {
  const { error } = await db.from('maintenance_logs').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete maintenance log: ${error.message}`);
}

export async function updateBill(id: string, input: UpdateBillInput): Promise<HousingBill> {
  const { data, error } = await db
    .from('housing_bills')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update bill: ${error.message}`);
  return data as HousingBill;
}

export async function updateMaintenanceLog(
  id: string,
  input: UpdateMaintenanceInput,
): Promise<MaintenanceLog> {
  const { data, error } = await db
    .from('maintenance_logs')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update maintenance log: ${error.message}`);
  return data as MaintenanceLog;
}
