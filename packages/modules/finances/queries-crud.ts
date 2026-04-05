import { db } from '@hawk/db';
import {
  DateStringSchema,
  HawkError,
  PositiveNumberSchema,
  TransactionTypeSchema,
  ValidationError,
  createLogger,
} from '@hawk/shared';
import { z } from 'zod';

const logger = createLogger('finances');

const CreateTransactionSchema = z.object({
  amount: PositiveNumberSchema,
  type: TransactionTypeSchema,
  date: DateStringSchema,
  description: z.string().min(1),
  account_id: z.string().uuid(),
});

import type {
  CreateAccountInput,
  CreateTransactionInput,
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  UpdateAccountInput,
  UpdateTransactionInput,
} from './types';

/**
 * Criar uma nova transação
 */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<FinanceTransaction> {
  const parsed = CreateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.flatten() }, 'Invalid transaction input');
    throw new ValidationError(
      `Invalid transaction: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  const { data, error } = await db
    .from('finance_transactions')
    .insert([
      {
        account_id: input.account_id,
        category_id: input.category_id,
        amount: input.amount,
        type: input.type,
        description: input.description,
        date: input.date || new Date().toISOString().split('T')[0],
        tags: input.tags || [],
      },
    ])
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create transaction');
    throw new HawkError(`Failed to create transaction: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as FinanceTransaction;
}

/**
 * Listar transações com filtros opcionais
 */
export async function listTransactions(
  accountId?: string,
  startDate?: string,
  endDate?: string,
  limit = 50,
  offset = 0,
): Promise<FinanceTransaction[]> {
  let query = db
    .from('finance_transactions')
    .select(
      'id, account_id, category_id, amount, type, description, date, tags, created_at, updated_at',
    )
    .order('date', { ascending: false });

  if (accountId) query = query.eq('account_id', accountId);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list transactions');
    throw new HawkError(`Failed to list transactions: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data || []) as FinanceTransaction[];
}

/**
 * Atualizar transação existente
 */
export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<FinanceTransaction> {
  const updates: Record<string, unknown> = {};
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.type !== undefined) updates.type = input.type;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category_id !== undefined) updates.category_id = input.category_id;
  if (input.account_id !== undefined) updates.account_id = input.account_id;
  if (input.date !== undefined) updates.date = input.date;
  if (input.tags !== undefined) updates.tags = input.tags;

  const { data, error } = await db
    .from('finance_transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update transaction');
    throw new HawkError(`Failed to update transaction: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as FinanceTransaction;
}

/**
 * Excluir transação por ID
 */
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await db.from('finance_transactions').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete transaction');
    throw new HawkError(`Failed to delete transaction: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

/**
 * Obter todas as contas
 */
export async function getAccounts(): Promise<FinanceAccount[]> {
  const { data, error } = await db
    .from('finance_accounts')
    .select('id, name, type, currency, balance, enabled')
    .eq('enabled', true)
    .order('name');

  if (error) {
    logger.error({ error: error.message }, 'Failed to get accounts');
    throw new HawkError(`Failed to get accounts: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data || []) as FinanceAccount[];
}

/**
 * Obter uma conta específica
 */
export async function getAccount(accountId: string): Promise<FinanceAccount> {
  const { data, error } = await db
    .from('finance_accounts')
    .select('id, name, type, currency, balance, enabled')
    .eq('id', accountId)
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to get account');
    throw new HawkError(`Failed to get account: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as FinanceAccount;
}

/**
 * Criar nova conta
 */
export async function createAccount(input: CreateAccountInput): Promise<FinanceAccount> {
  const { data, error } = await db
    .from('finance_accounts')
    .insert({
      name: input.name,
      type: input.type,
      currency: input.currency ?? 'BRL',
      balance: input.balance ?? 0,
      enabled: true,
    })
    .select('id, name, type, currency, balance, enabled')
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create account');
    throw new HawkError(`Failed to create account: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as FinanceAccount;
}

/**
 * Atualizar conta
 */
export async function updateAccount(
  id: string,
  input: UpdateAccountInput,
): Promise<FinanceAccount> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.balance !== undefined) updates.balance = input.balance;
  if (input.enabled !== undefined) updates.enabled = input.enabled;

  const { data, error } = await db
    .from('finance_accounts')
    .update(updates)
    .eq('id', id)
    .select('id, name, type, currency, balance, enabled')
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update account');
    throw new HawkError(`Failed to update account: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as FinanceAccount;
}

/**
 * Desabilitar conta (soft delete)
 */
export async function disableAccount(id: string): Promise<void> {
  const { error } = await db.from('finance_accounts').update({ enabled: false }).eq('id', id);

  if (error) {
    logger.error({ error: error.message }, 'Failed to disable account');
    throw new HawkError(`Failed to disable account: ${error.message}`, 'DB_QUERY_FAILED');
  }
}

/**
 * Buscar contas por nome (para @mentions)
 */
export async function searchAccounts(query: string, limit = 5): Promise<FinanceAccount[]> {
  const safeQuery = query.slice(0, 100);
  const { data, error } = await db
    .from('finance_accounts')
    .select('id, name, type, currency, balance, enabled')
    .eq('enabled', true)
    .ilike('name', `%${safeQuery}%`)
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search accounts');
    throw new HawkError(`Failed to search accounts: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as FinanceAccount[];
}

/**
 * Obter todas as categorias
 */
export async function getCategories(type?: 'income' | 'expense'): Promise<FinanceCategory[]> {
  let query = db.from('finance_categories').select('id, name, type, icon, color');

  if (type) query = query.eq('type', type);

  const { data, error } = await query.order('name');
  if (error) {
    logger.error({ error: error.message }, 'Failed to get categories');
    throw new HawkError(`Failed to get categories: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data || []) as FinanceCategory[];
}

/**
 * Obter uma categoria por ID
 */
export async function getCategory(categoryId: string): Promise<FinanceCategory> {
  const { data, error } = await db
    .from('finance_categories')
    .select('id, name, type, icon, color')
    .eq('id', categoryId)
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to get category');
    throw new HawkError(`Failed to get category: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as FinanceCategory;
}

/**
 * Atualizar saldo da conta
 */
export async function updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
  const { error } = await db
    .from('finance_accounts')
    .update({ balance: newBalance })
    .eq('id', accountId);

  if (error) {
    logger.error({ error: error.message }, 'Failed to update account');
    throw new HawkError(`Failed to update account: ${error.message}`, 'DB_UPDATE_FAILED');
  }
}
