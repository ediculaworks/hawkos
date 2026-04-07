'use server';

import { getSafeSchema } from '@/lib/auth/safe-schema';
import { getPool } from '@hawk/db';

export interface ModuleCompleteness {
  moduleId: string;
  label: string;
  complete: boolean;
  score: number; // 0-100
  missing: string[];
}

export interface CompletenessReport {
  total: number;
  complete: number;
  percentage: number;
  modules: ModuleCompleteness[];
}

/**
 * Calculate data completeness score for the current tenant.
 * Each module has a set of checks — the score reflects how many are satisfied.
 */
export async function fetchCompletenessReport(): Promise<CompletenessReport> {
  const schema = await getSafeSchema();
  const sql = getPool();

  // Run all checks in parallel using COUNT queries per table
  const checks = await Promise.allSettled([
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".finance_accounts`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".finance_categories`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".finance_transactions`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".sleep_sessions`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".workout_sessions`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".people`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".objectives`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".habits`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".events`),
    sql.unsafe(`SELECT count(*) as n FROM "${schema}".legal_obligations`),
  ]);

  const count = (i: number): number => {
    const r = checks[i];
    if (!r || r.status === 'rejected') return 0;
    return Number((r.value as Array<{ n: unknown }>)[0]?.n ?? 0);
  };

  const hasAccounts = count(0) > 0;
  const hasCategories = count(1) > 0;
  const hasTx = count(2) > 0;
  const hasSleep = count(3) > 0;
  const hasWorkout = count(4) > 0;
  const hasPeople = count(5) > 0;
  const hasObjectives = count(6) > 0;
  const hasHabits = count(7) > 0;
  const hasEvents = count(8) > 0;
  const hasLegal = count(9) > 0;

  const modules: ModuleCompleteness[] = [
    {
      moduleId: 'finances',
      label: 'Finanças',
      complete: hasAccounts && hasCategories && hasTx,
      score: [hasAccounts, hasCategories, hasTx].filter(Boolean).length * 33,
      missing: [
        !hasAccounts ? 'Conta bancária' : null,
        !hasCategories ? 'Categorias' : null,
        !hasTx ? 'Transações' : null,
      ].filter((x): x is string => x !== null),
    },
    {
      moduleId: 'health',
      label: 'Saúde',
      complete: hasSleep && hasWorkout,
      score: [hasSleep, hasWorkout].filter(Boolean).length * 50,
      missing: [
        !hasSleep ? 'Registo de sono' : null,
        !hasWorkout ? 'Registo de treino' : null,
      ].filter((x): x is string => x !== null),
    },
    {
      moduleId: 'people',
      label: 'Pessoas',
      complete: hasPeople,
      score: hasPeople ? 100 : 0,
      missing: !hasPeople ? ['Contactos'] : [],
    },
    {
      moduleId: 'objectives',
      label: 'Objectivos',
      complete: hasObjectives,
      score: hasObjectives ? 100 : 0,
      missing: !hasObjectives ? ['Objectivos definidos'] : [],
    },
    {
      moduleId: 'routine',
      label: 'Rotina',
      complete: hasHabits,
      score: hasHabits ? 100 : 0,
      missing: !hasHabits ? ['Hábitos'] : [],
    },
    {
      moduleId: 'calendar',
      label: 'Calendário',
      complete: hasEvents,
      score: hasEvents ? 100 : 0,
      missing: !hasEvents ? ['Eventos'] : [],
    },
    {
      moduleId: 'legal',
      label: 'Legal',
      complete: hasLegal,
      score: hasLegal ? 100 : 0,
      missing: !hasLegal ? ['Obrigações legais'] : [],
    },
  ];

  const complete = modules.filter((m) => m.complete).length;
  const percentage = Math.round((complete / modules.length) * 100);

  return {
    total: modules.length,
    complete,
    percentage,
    modules,
  };
}
