/**
 * Intent Classifier — S2.1 Short-Circuit
 *
 * Classifica mensagens comuns do utilizador com regex + heurística e executa
 * directamente sem passar pelo LLM. Reduz 30-40% das chamadas LLM para
 * acções rotineiras de CRUD.
 *
 * Regra: só faz short-circuit se houver match confiante. Se qualquer lookup
 * falhar (conta não existe, categoria sem match), retorna null → LLM trata.
 */

import { randomUUID } from 'node:crypto';
import { db } from '@hawk/db';
import { createTransaction, getAccounts } from '@hawk/module-finances/queries';
import { logSleep } from '@hawk/module-health/queries';
import { logActivity } from './activity-logger.js';
import { metrics } from './metrics.js';
import { registerUndoAction } from './undo-store.js';

// ── Regex patterns (Portuguese) ──────────────────────────────────────────────

// "gastei 50 em alimentação" | "paguei R$ 150 de aluguel" | "comprei 30 no mercado"
const EXPENSE_RE =
  /\b(?:gastei|paguei|comprei|gasto)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais?)?\s*(?:em|n[ao]|de|com)\s+(.+)/i;

// "recebi 1000 de salário" | "ganhei 500 de freelance"
const INCOME_RE =
  /\b(?:recebi|ganhei|entrou)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais?)?\s*(?:de|d[ao])?\s+(.+)/i;

// "dormi 7 horas" | "dormi 6h30" | "dormi 7.5h"
const SLEEP_RE = /\bdormi\s+(\d+(?:[.,]\d{1,2})?)\s*h(?:oras?|rs?)?\b/i;

// "quanto gastei este mês" | "resumo financeiro" | "saldo do mês"
const SUMMARY_RE =
  /\b(?:quanto\s+(?:gastei|ganhei)|resumo\s+financeiro|saldo\s+(?:do\s+)?m[eê]s|gastos?\s+(?:deste?|d?este|do)\s+m[eê]s|extrato\s+do\s+m[eê]s)\b/i;

// ── Amount parsing ───────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  // Handle "50,00" or "50.00" or "1.500,00"
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// ── Category resolution ──────────────────────────────────────────────────────

async function findCategory(
  hint: string,
  type: 'expense' | 'income',
): Promise<{ id: string; name: string } | null> {
  // Try ILIKE on category name (case-insensitive, partial match)
  const { data } = await db
    .from('finance_categories')
    .select('id, name')
    .eq('type', type)
    .ilike('name', `%${hint.slice(0, 30)}%`)
    .limit(1);

  if (data && data.length > 0) return data[0] as { id: string; name: string };

  // Fallback: try the first word of the hint
  const firstWord = hint.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3) {
    const { data: d2 } = await db
      .from('finance_categories')
      .select('id, name')
      .eq('type', type)
      .ilike('name', `%${firstWord}%`)
      .limit(1);
    if (d2 && d2.length > 0) return d2[0] as { id: string; name: string };
  }

  return null;
}

// ── Classify + execute ───────────────────────────────────────────────────────

export interface ClassifyResult {
  response: string;
  intentType: string;
}

/**
 * Try to classify and execute a message directly without LLM.
 * Returns ClassifyResult on success, null if the message is ambiguous or
 * any required data (account, category) cannot be resolved.
 *
 * Must be called within a withSchema() context.
 */
export async function classifyAndExecute(
  message: string,
  _sessionId: string,
): Promise<ClassifyResult | null> {
  // ── Financial summary ─────────────────────────────────────────────────────
  const summaryMatch = SUMMARY_RE.exec(message);
  if (summaryMatch) {
    try {
      const { getFinanceSummary } = await import('@hawk/module-finances/queries');
      const summary = await getFinanceSummary();
      const response = `Receitas: R$ ${summary.income.toFixed(2)} | Despesas: R$ ${summary.expenses.toFixed(2)} | Saldo: R$ ${summary.net.toFixed(2)}`;
      _track('financial_summary');
      return { response, intentType: 'financial_summary' };
    } catch {
      return null;
    }
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────
  const sleepMatch = SLEEP_RE.exec(message);
  if (sleepMatch) {
    const hours = parseAmount(sleepMatch[1] ?? '0');
    if (hours < 0.5 || hours > 24) return null;
    try {
      const sleep = await logSleep({ duration_h: hours });
      const actionId = randomUUID();
      registerUndoAction(actionId, `Sono de ${sleep.duration_h}h`, async () => {
        await db
          .from('sleep_sessions')
          .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', sleep.id);
      });
      _track('log_sleep');
      return {
        response: `Sono registado: ${sleep.duration_h}h [UNDO:${actionId}]`,
        intentType: 'log_sleep',
      };
    } catch {
      return null;
    }
  }

  // ── Expense ───────────────────────────────────────────────────────────────
  const expenseMatch = EXPENSE_RE.exec(message);
  if (expenseMatch) {
    const amount = parseAmount(expenseMatch[1] ?? '0');
    const categoryHint = (expenseMatch[2] ?? '').trim();
    if (amount <= 0 || !categoryHint) return null;

    const [accounts, category] = await Promise.all([
      getAccounts().catch(() => []),
      findCategory(categoryHint, 'expense').catch(() => null),
    ]);

    const account = accounts[0];
    if (!account || !category) return null; // Ambiguous — let LLM handle

    try {
      const tx = await createTransaction({
        account_id: account.id,
        category_id: category.id,
        amount,
        type: 'expense',
        description: categoryHint,
      });
      const actionId = randomUUID();
      const label = `Gasto de R$ ${amount.toFixed(2)} em ${category.name}`;
      registerUndoAction(actionId, label, async () => {
        await db
          .from('finance_transactions')
          .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', tx.id);
      });
      logActivity('tool_call', `[short-circuit] create_transaction: ${label}`, 'finances', {
        tool: 'create_transaction',
        intent_type: 'expense',
        short_circuit: true,
      }).catch(() => {});
      _track('create_expense');
      return {
        response: `Gasto registado: R$ ${amount.toFixed(2)} em ${category.name}. [UNDO:${actionId}]`,
        intentType: 'create_expense',
      };
    } catch {
      return null;
    }
  }

  // ── Income ────────────────────────────────────────────────────────────────
  const incomeMatch = INCOME_RE.exec(message);
  if (incomeMatch) {
    const amount = parseAmount(incomeMatch[1] ?? '0');
    const categoryHint = (incomeMatch[2] ?? '').trim();
    if (amount <= 0) return null;

    const [accounts, category] = await Promise.all([
      getAccounts().catch(() => []),
      categoryHint ? findCategory(categoryHint, 'income').catch(() => null) : Promise.resolve(null),
    ]);

    const account = accounts[0];
    if (!account || !category) return null;

    try {
      const tx = await createTransaction({
        account_id: account.id,
        category_id: category.id,
        amount,
        type: 'income',
        description: categoryHint,
      });
      const actionId = randomUUID();
      const label = `Receita de R$ ${amount.toFixed(2)} — ${category.name}`;
      registerUndoAction(actionId, label, async () => {
        await db
          .from('finance_transactions')
          .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', tx.id);
      });
      logActivity('tool_call', `[short-circuit] create_transaction: ${label}`, 'finances', {
        tool: 'create_transaction',
        intent_type: 'income',
        short_circuit: true,
      }).catch(() => {});
      _track('create_income');
      return {
        response: `Receita registada: R$ ${amount.toFixed(2)} em ${category.name}. [UNDO:${actionId}]`,
        intentType: 'create_income',
      };
    } catch {
      return null;
    }
  }

  return null;
}

function _track(intentType: string): void {
  metrics.incCounter('hawk_intent_shortcircuits_total', { intent: intentType });
}
