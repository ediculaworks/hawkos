import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';
import type {
  CreateBillInput,
  CreateMaintenanceInput,
  HousingBill,
  MaintenanceLog,
  Residence,
  UpdateBillInput,
  UpdateMaintenanceInput,
} from './types';
const logger = createLogger('housing');

const CreateBillSchema = z.object({ name: z.string().min(1) });

export async function listResidences(): Promise<Residence[]> {
  const { data, error } = await db.from('residences').select('*').eq('active', true);
  if (error) {
    logger.error({ error: error.message }, 'Failed to list residences');
    throw new HawkError(`Failed to list residences: ${error.message}`, 'DB_QUERY_FAILED');
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to get primary residence');
    throw new HawkError(`Failed to get primary residence: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Residence | null;
}

export async function createBill(input: CreateBillInput): Promise<HousingBill> {
  const parsed = CreateBillSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to create bill');
    throw new HawkError(`Failed to create bill: ${error.message}`, 'DB_INSERT_FAILED');
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to list bills');
    throw new HawkError(`Failed to list bills: ${error.message}`, 'DB_QUERY_FAILED');
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to mark bill as paid');
    throw new HawkError(`Failed to mark bill as paid: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as HousingBill;
}

export async function getPendingBills(): Promise<HousingBill[]> {
  const { data, error } = await db
    .from('housing_bills')
    .select('*')
    .eq('active', true)
    .eq('status', 'pending')
    .order('due_day', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get pending bills');
    throw new HawkError(`Failed to get pending bills: ${error.message}`, 'DB_QUERY_FAILED');
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to create maintenance log');
    throw new HawkError(`Failed to create maintenance log: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as MaintenanceLog;
}

export async function listMaintenance(residenceId?: string): Promise<MaintenanceLog[]> {
  let query = db.from('maintenance_logs').select('*').order('date', { ascending: false }).limit(10);
  if (residenceId) query = query.eq('residence_id', residenceId);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list maintenance');
    throw new HawkError(`Failed to list maintenance: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as MaintenanceLog[];
}

export async function getMonthlyBillTotal(): Promise<number> {
  const { data, error } = await db
    .from('housing_bills')
    .select('amount')
    .eq('active', true)
    .eq('status', 'pending');
  if (error) {
    logger.error({ error: error.message }, 'Failed to get bill total');
    throw new HawkError(`Failed to get bill total: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []).reduce(
    (sum: number, row: { amount: number | null }) => sum + (row.amount ?? 0),
    0,
  );
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await db.from('housing_bills').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete bill');
    throw new HawkError(`Failed to delete bill: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

export async function deleteMaintenanceLog(id: string): Promise<void> {
  const { error } = await db.from('maintenance_logs').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete maintenance log');
    throw new HawkError(`Failed to delete maintenance log: ${error.message}`, 'DB_INSERT_FAILED');
  }
}

export async function updateBill(id: string, input: UpdateBillInput): Promise<HousingBill> {
  const { data, error } = await db
    .from('housing_bills')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to update bill');
    throw new HawkError(`Failed to update bill: ${error.message}`, 'DB_UPDATE_FAILED');
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to update maintenance log');
    throw new HawkError(`Failed to update maintenance log: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as MaintenanceLog;
}
