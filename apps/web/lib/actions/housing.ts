'use server';

import {
  createBill,
  createMaintenance,
  deleteBill as deleteBillQuery,
  deleteMaintenanceLog as deleteMaintenanceLogQuery,
  getMonthlyBillTotal,
  getPendingBills,
  listBills,
  listMaintenance,
  listResidences,
  markBillPaid,
  updateBill as updateBillQuery,
  updateMaintenanceLog as updateMaintenanceLogQuery,
} from '@hawk/module-housing/queries';
import { withTenant } from '../supabase/with-tenant';

import type {
  HousingBill,
  MaintenanceLog,
  Residence,
  UpdateBillInput,
  UpdateMaintenanceInput,
} from '@hawk/module-housing/types';

export async function fetchResidences(): Promise<Residence[]> {
  return withTenant(async () => listResidences());
}

export async function fetchPendingBills(): Promise<HousingBill[]> {
  return withTenant(async () => getPendingBills());
}

export async function fetchBills(): Promise<HousingBill[]> {
  return withTenant(async () => listBills());
}

export async function fetchMaintenance(): Promise<MaintenanceLog[]> {
  return withTenant(async () => listMaintenance());
}

export async function fetchMonthlyBillTotal(): Promise<number> {
  return withTenant(async () => getMonthlyBillTotal());
}

export async function addBill(input: {
  residence_id: string;
  name: string;
  amount: number;
  due_day: number;
}): Promise<HousingBill> {
  return withTenant(async () => createBill(input));
}

export async function addMaintenance(input: {
  residence_id: string;
  description: string;
  cost?: number;
}): Promise<MaintenanceLog> {
  return withTenant(async () => createMaintenance(input));
}

export async function deleteBill(id: string): Promise<void> {
  return withTenant(async () => deleteBillQuery(id));
}

export async function deleteMaintenanceLog(id: string): Promise<void> {
  return withTenant(async () => deleteMaintenanceLogQuery(id));
}

export async function payBill(id: string): Promise<HousingBill> {
  return withTenant(async () => markBillPaid(id));
}

export async function editBill(id: string, input: UpdateBillInput): Promise<HousingBill> {
  return withTenant(async () => updateBillQuery(id, input));
}

export async function editMaintenance(
  id: string,
  input: UpdateMaintenanceInput,
): Promise<MaintenanceLog> {
  return withTenant(async () => updateMaintenanceLogQuery(id, input));
}
