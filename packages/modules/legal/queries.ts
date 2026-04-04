import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';
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

const logger = createLogger('legal');

/**
 * Listar obrigações pendentes ordenadas por data
 */
export async function listPendingObligations(): Promise<ObligationWithDaysLeft[]> {
  const { data, error } = await db
    .from('legal_obligations')
    .select('*')
    .in('status', ['pending', 'late'])
    .order('due_date', { ascending: true });

  if (error) {
    logger.error({ error: error.message }, 'Failed to list obligations');
    throw new HawkError(`Failed to list obligations: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data ?? []).map((o: LegalObligation) => {
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to complete obligation');
    throw new HawkError(`Failed to complete obligation: ${error.message}`, 'DB_UPDATE_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list contracts');
    throw new HawkError(`Failed to list contracts: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list contracts');
    throw new HawkError(`Failed to list contracts: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list entities');
    throw new HawkError(`Failed to list entities: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get expiring contracts');
    throw new HawkError(`Failed to get expiring contracts: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data ?? []).map((c: Contract) => ({
    ...c,
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete obligation');
    throw new HawkError(`Failed to delete obligation: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

/**
 * Deletar contrato
 */
export async function deleteContract(id: string): Promise<void> {
  const { error } = await db.from('contracts').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete contract');
    throw new HawkError(`Failed to delete contract: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

/**
 * Deletar entidade jurídica
 */
export async function deleteLegalEntity(id: string): Promise<void> {
  const { error } = await db.from('legal_entities').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete legal entity');
    throw new HawkError(`Failed to delete legal entity: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

// ============================================================
// CREATE
// ============================================================

/**
 * Criar obrigação legal
 */
const createObligationSchema = z.object({
  name: z.string().min(1).max(300),
  type: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frequency: z.string().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
  entity_id: z.string().uuid().optional(),
});

export async function createObligation(input: CreateObligationInput): Promise<LegalObligation> {
  const parsed = createObligationSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid createObligation input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to create obligation');
    throw new HawkError(`Failed to create obligation: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to create contract');
    throw new HawkError(`Failed to create contract: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to create legal entity');
    throw new HawkError(`Failed to create legal entity: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to update obligation');
    throw new HawkError(`Failed to update obligation: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as LegalObligation;
}

/**
 * Atualizar contrato
 */
export async function updateContract(id: string, input: UpdateContractInput): Promise<Contract> {
  const { data, error } = await db.from('contracts').update(input).eq('id', id).select().single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update contract');
    throw new HawkError(`Failed to update contract: ${error.message}`, 'DB_UPDATE_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to update legal entity');
    throw new HawkError(`Failed to update legal entity: ${error.message}`, 'DB_UPDATE_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to log contract audit');
    throw new HawkError(`Failed to log contract audit: ${error.message}`, 'DB_INSERT_FAILED');
  }
}
