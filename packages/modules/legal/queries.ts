import { db } from '@hawk/db';
import type {
  Contract,
  CreateContractInput,
  CreateLegalEntityInput,
  CreateObligationInput,
  LegalEntity,
  LegalObligation,
  ObligationWithDaysLeft,
  UpdateContractInput,
  UpdateLegalEntityInput,
  UpdateObligationInput,
} from './types';

/**
 * Listar obrigações pendentes ordenadas por data
 */
export async function listPendingObligations(): Promise<ObligationWithDaysLeft[]> {
  const { data, error } = await db
    .from('legal_obligations')
    .select('*')
    .in('status', ['pending', 'late'])
    .order('due_date', { ascending: true });

  if (error) throw new Error(`Failed to list obligations: ${error.message}`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data ?? []).map((o) => {
    const due = new Date(o.due_date as string);
    const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let urgency: ObligationWithDaysLeft['urgency'] = 'ok';
    if (daysLeft < 0)
      urgency = 'critical'; // vencida
    else if (daysLeft <= 1)
      urgency = 'critical'; // amanhã ou hoje
    else if (daysLeft <= 7)
      urgency = 'urgent'; // até 7 dias
    else if (daysLeft <= 15) urgency = 'warning'; // até 15 dias

    return { ...(o as LegalObligation), days_until_due: daysLeft, urgency };
  });
}

/**
 * Marcar obrigação como concluída
 */
export async function completeObligation(id: string): Promise<LegalObligation> {
  const { data, error } = await db
    .from('legal_obligations')
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete obligation: ${error.message}`);
  return data as LegalObligation;
}

/**
 * Listar contratos ativos
 */
export async function listActiveContracts(): Promise<Contract[]> {
  const { data, error } = await db
    .from('contracts')
    .select('*')
    .eq('status', 'active')
    .order('end_date', { ascending: true });

  if (error) throw new Error(`Failed to list contracts: ${error.message}`);
  return (data ?? []) as Contract[];
}

/**
 * Listar todos os contratos (todos os status)
 */
export async function listAllContracts(): Promise<Contract[]> {
  const { data, error } = await db
    .from('contracts')
    .select('*')
    .order('end_date', { ascending: true });

  if (error) throw new Error(`Failed to list contracts: ${error.message}`);
  return (data ?? []) as Contract[];
}

/**
 * Listar entidades jurídicas
 */
export async function listLegalEntities(): Promise<LegalEntity[]> {
  const { data, error } = await db
    .from('legal_entities')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) throw new Error(`Failed to list entities: ${error.message}`);
  return (data ?? []) as LegalEntity[];
}

/**
 * Obrigações urgentes (críticas/urgentes) — para alertas automáticos
 */
export async function getUrgentObligations(maxDays = 15): Promise<ObligationWithDaysLeft[]> {
  const all = await listPendingObligations();
  return all.filter((o) => o.days_until_due <= maxDays);
}

// ============================================================
// CONTRACT LIFECYCLE (Documenso pattern)
// ============================================================

/**
 * Contratos que vencem nos próximos N dias
 */
export async function getExpiringContracts(
  daysAhead = 30,
): Promise<(Contract & { days_until_expiry: number })[]> {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  const { data, error } = await db
    .from('contracts')
    .select('*')
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lte('end_date', future.toISOString().split('T')[0])
    .gte('end_date', now.toISOString().split('T')[0])
    .order('end_date', { ascending: true });

  if (error) throw new Error(`Failed to get expiring contracts: ${error.message}`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data ?? []).map((c) => ({
    ...(c as Contract),
    days_until_expiry: Math.round(
      (new Date(c.end_date as string).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    ),
  }));
}

/**
 * Deletar obrigação
 */
export async function deleteObligation(id: string): Promise<void> {
  const { error } = await db.from('legal_obligations').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete obligation: ${error.message}`);
}

/**
 * Deletar contrato
 */
export async function deleteContract(id: string): Promise<void> {
  const { error } = await db.from('contracts').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete contract: ${error.message}`);
}

/**
 * Deletar entidade jurídica
 */
export async function deleteLegalEntity(id: string): Promise<void> {
  const { error } = await db.from('legal_entities').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete legal entity: ${error.message}`);
}

// ============================================================
// CREATE
// ============================================================

/**
 * Criar obrigação legal
 */
export async function createObligation(input: CreateObligationInput): Promise<LegalObligation> {
  const { data, error } = await db
    .from('legal_obligations')
    .insert({
      name: input.name,
      type: input.type,
      due_date: input.due_date,
      frequency: input.frequency ?? null,
      amount: input.amount ?? null,
      notes: input.notes ?? null,
      entity_id: input.entity_id ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create obligation: ${error.message}`);
  return data as LegalObligation;
}

/**
 * Criar contrato
 */
export async function createContract(input: CreateContractInput): Promise<Contract> {
  const { data, error } = await db
    .from('contracts')
    .insert({
      title: input.title,
      parties: input.parties ?? [],
      entity_id: input.entity_id ?? null,
      type: input.type ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      value: input.value ?? null,
      notes: input.notes ?? null,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create contract: ${error.message}`);
  return data as Contract;
}

/**
 * Criar entidade jurídica
 */
export async function createLegalEntity(input: CreateLegalEntityInput): Promise<LegalEntity> {
  const { data, error } = await db
    .from('legal_entities')
    .insert({
      name: input.name,
      type: input.type,
      document: input.document ?? null,
      registration_date: input.registration_date ?? null,
      notes: input.notes ?? null,
      active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create legal entity: ${error.message}`);
  return data as LegalEntity;
}

// ============================================================
// UPDATE
// ============================================================

/**
 * Atualizar obrigação
 */
export async function updateObligation(
  id: string,
  input: UpdateObligationInput,
): Promise<LegalObligation> {
  const { data, error } = await db
    .from('legal_obligations')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update obligation: ${error.message}`);
  return data as LegalObligation;
}

/**
 * Atualizar contrato
 */
export async function updateContract(id: string, input: UpdateContractInput): Promise<Contract> {
  const { data, error } = await db.from('contracts').update(input).eq('id', id).select().single();

  if (error) throw new Error(`Failed to update contract: ${error.message}`);
  return data as Contract;
}

/**
 * Atualizar entidade jurídica
 */
export async function updateLegalEntity(
  id: string,
  input: UpdateLegalEntityInput,
): Promise<LegalEntity> {
  const { data, error } = await db
    .from('legal_entities')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update legal entity: ${error.message}`);
  return data as LegalEntity;
}

/**
 * Registrar evento no audit log do contrato
 */
export async function logContractAudit(
  contractId: string,
  action: string,
  details?: string,
): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: contract_audit_log not in generated types
  const { error } = await (db as any).from('contract_audit_log').insert({
    contract_id: contractId,
    action,
    details: details ?? null,
  });

  if (error) throw new Error(`Failed to log contract audit: ${error.message}`);
}
