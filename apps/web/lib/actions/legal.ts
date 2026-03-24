'use server';

import {
  completeObligation,
  createContract,
  createLegalEntity,
  createObligation,
  deleteContract,
  deleteLegalEntity,
  deleteObligation,
  getUrgentObligations,
  listActiveContracts,
  listAllContracts,
  listLegalEntities,
  listPendingObligations,
  updateContract,
  updateLegalEntity,
  updateObligation,
} from '@hawk/module-legal/queries';
import { withTenant } from '../supabase/with-tenant';

import type {
  Contract,
  CreateContractInput,
  CreateLegalEntityInput,
  CreateObligationInput,
  LegalEntity,
  ObligationWithDaysLeft,
  UpdateContractInput,
  UpdateLegalEntityInput,
  UpdateObligationInput,
} from '@hawk/module-legal/types';

export async function fetchPendingObligations(): Promise<ObligationWithDaysLeft[]> {
  return withTenant(async () => listPendingObligations());
}

export async function fetchUrgentObligations(): Promise<ObligationWithDaysLeft[]> {
  return withTenant(async () => getUrgentObligations(15));
}

export async function fetchActiveContracts(): Promise<Contract[]> {
  return withTenant(async () => listActiveContracts());
}

export async function fetchAllContracts(): Promise<Contract[]> {
  return withTenant(async () => listAllContracts());
}

export async function fetchLegalEntities(): Promise<LegalEntity[]> {
  return withTenant(async () => listLegalEntities());
}

export async function completeObligationAction(id: string): Promise<void> {
  return withTenant(async () => {
    await completeObligation(id);
  });
}

export async function deleteObligationAction(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteObligation(id);
  });
}

export async function deleteContractAction(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteContract(id);
  });
}

export async function deleteLegalEntityAction(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteLegalEntity(id);
  });
}

export async function addObligation(input: CreateObligationInput): Promise<void> {
  return withTenant(async () => {
    await createObligation(input);
  });
}

export async function addContract(input: CreateContractInput): Promise<void> {
  return withTenant(async () => {
    await createContract(input);
  });
}

export async function addLegalEntity(input: CreateLegalEntityInput): Promise<void> {
  return withTenant(async () => {
    await createLegalEntity(input);
  });
}

export async function editObligation(id: string, input: UpdateObligationInput): Promise<void> {
  return withTenant(async () => {
    await updateObligation(id, input);
  });
}

export async function editContract(id: string, input: UpdateContractInput): Promise<void> {
  return withTenant(async () => {
    await updateContract(id, input);
  });
}

export async function editLegalEntity(id: string, input: UpdateLegalEntityInput): Promise<void> {
  return withTenant(async () => {
    await updateLegalEntity(id, input);
  });
}
