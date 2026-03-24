// Context Engine: Health / Saúde
// L0: snapshot de hoje (sono, treino, peso, substâncias)
// L1: semana completa com médias e alertas
// L2: histórico detalhado + condições + medicamentos + exames

import {
  getDailyHealthSummary,
  getSubstanceStats,
  getWeekHealthStats,
  listActiveMedications,
  listConditions,
  listLabResults,
  listRecentSleep,
  listRecentWorkouts,
} from './queries';

/**
 * L0 — Snapshot de hoje: sono, treino, peso atual, substâncias
 * ~100 tokens, sempre no system prompt
 */
export async function loadL0(): Promise<string> {
  try {
    const summary = await getDailyHealthSummary();
    const parts: string[] = [];

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    parts.push(`Saúde ${today}:`);

    if (summary?.sleep_hours) {
      parts.push(
        `sono ${summary.sleep_hours}h${summary.sleep_quality ? ` q${summary.sleep_quality}` : ''}`,
      );
    } else {
      parts.push('sono não registrado');
    }

    if (summary?.exercised) {
      parts.push(`treino: ${summary.workout_type ?? 'sim'}`);
    } else {
      parts.push('sem treino');
    }

    if (summary?.weight_kg) parts.push(`peso ${summary.weight_kg}kg`);
    if (summary?.mood) parts.push(`humor ${summary.mood}/10`);

    if (summary?.cannabis_g && summary.cannabis_g > 0) {
      parts.push(`cannabis ${summary.cannabis_g}g`);
    }

    return parts.join(' · ');
  } catch (_error) {
    return 'Saúde: indisponível';
  }
}

/**
 * L1 — Resumo semanal: médias, streaks, alertas ativos
 * ~1.5k tokens, carregado quando módulo é relevante
 */
export async function loadL1(): Promise<string> {
  try {
    const [stats, sleep7, _workouts7, substStats, meds] = await Promise.all([
      getWeekHealthStats(),
      listRecentSleep(7),
      listRecentWorkouts(7),
      getSubstanceStats(7),
      listActiveMedications(),
    ]);

    const lines: string[] = ['--- SAÚDE — SEMANA ---'];

    // Sono
    if (stats.avg_sleep_h !== null) {
      const qualStr = stats.avg_sleep_quality
        ? ` · qualidade média ${stats.avg_sleep_quality}/10`
        : '';
      const sleepDays = sleep7.length;
      lines.push(`🌙 Sono: ${stats.avg_sleep_h}h/dia (${sleepDays}/7 dias registrados)${qualStr}`);
      if (stats.avg_sleep_h < 6) lines.push('  ⚠️ ALERTA: média de sono abaixo de 6h');
    } else {
      lines.push('🌙 Sono: sem registros na semana');
    }

    // Exercício
    lines.push(`💪 Treinos: ${stats.workouts_count}/7 dias`);
    if (stats.workouts_count === 0) lines.push('  ⚠️ Nenhum treino essa semana');

    // Peso
    if (stats.latest_weight) lines.push(`⚖️ Peso atual: ${stats.latest_weight}kg`);

    // Humor/energia
    if (stats.avg_mood) lines.push(`😊 Humor médio: ${stats.avg_mood}/10`);
    if (stats.avg_energy) lines.push(`⚡ Energia média: ${stats.avg_energy}/10`);

    // Substâncias
    if (substStats.length > 0) {
      lines.push('🌿 Substâncias (semana):');
      for (const s of substStats) {
        const qtyStr = s.total_quantity && s.unit ? ` — ${s.total_quantity}${s.unit}` : '';
        const costStr = s.total_cost ? ` (R$${s.total_cost.toFixed(2)})` : '';
        lines.push(`  • ${s.substance}: ${s.days_used}/7 dias${qtyStr}${costStr}`);
      }
    }

    // Medicamentos ativos
    if (meds.length > 0) {
      lines.push(`💊 Remédios ativos: ${meds.map((m) => m.name).join(', ')}`);
      if (stats.med_adherence_pct !== null) {
        lines.push(`  Aderência: ${stats.med_adherence_pct}%`);
        if (stats.med_adherence_pct < 80) lines.push('  ⚠️ ALERTA: aderência abaixo de 80%');
      }
    }

    return lines.join('\n');
  } catch (_error) {
    return 'Saúde (semana): indisponível';
  }
}

/**
 * L2 — Histórico completo: condições, exames, tendências, correlações
 * Ilimitado, carregado para perguntas específicas
 */
export async function loadL2(): Promise<string> {
  try {
    const [conditions, meds, labs, sleep14, workouts14, substStats30] = await Promise.all([
      listConditions(),
      listActiveMedications(),
      listLabResults(10),
      listRecentSleep(14),
      listRecentWorkouts(20),
      getSubstanceStats(30),
    ]);

    const sections: string[] = ['=== SAÚDE — HISTÓRICO COMPLETO ==='];

    // Condições / comorbidades
    if (conditions.length > 0) {
      sections.push('\n--- CONDIÇÕES ---');
      for (const c of conditions) {
        const diagStr = c.diagnosed_at ? ` (desde ${new Date(c.diagnosed_at).getFullYear()})` : '';
        const statusLabel =
          c.status === 'active'
            ? 'ativa'
            : c.status === 'managed'
              ? 'controlada'
              : c.status === 'resolved'
                ? 'resolvida'
                : 'suspeita';
        sections.push(
          `• ${c.name}${c.icd10_code ? ` [${c.icd10_code}]` : ''}${diagStr} — ${statusLabel}`,
        );
        if (c.notes) sections.push(`  ${c.notes}`);
      }
    }

    // Medicamentos ativos
    if (meds.length > 0) {
      sections.push('\n--- MEDICAMENTOS ATIVOS ---');
      for (const m of meds) {
        const dosStr = m.dosage ? ` ${m.dosage}` : '';
        const freqLabels: Record<string, string> = {
          daily: '1x/dia',
          twice_daily: '2x/dia',
          three_times_daily: '3x/dia',
          as_needed: 'se necessário',
          weekly: 'semanal',
          other: '',
        };
        sections.push(
          `• ${m.name}${dosStr} — ${freqLabels[m.frequency] ?? m.frequency}${m.indication ? ` (${m.indication})` : ''}`,
        );
      }
    }

    // Exames recentes
    if (labs.length > 0) {
      sections.push('\n--- EXAMES RECENTES ---');
      for (const r of labs) {
        const date = new Date(r.collected_at).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        });
        const valStr =
          r.value_number !== null ? ` ${r.value_number}${r.unit ? ` ${r.unit}` : ''}` : '';
        const statusStr = r.status ? ` [${r.status}]` : '';
        sections.push(`• ${date} ${r.name}${valStr}${statusStr}`);
      }
    }

    // Sono últimas 2 semanas
    if (sleep14.length > 0) {
      sections.push('\n--- SONO — 14 DIAS ---');
      const avgSleep = sleep14.reduce((s, r) => s + (r.duration_h ?? 0), 0) / sleep14.length;
      sections.push(`Média: ${avgSleep.toFixed(1)}h`);
      for (const s of sleep14) {
        const date = new Date(s.date).toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });
        const qualStr = s.quality ? ` q${s.quality}/10` : '';
        sections.push(`• ${date}: ${s.duration_h ?? '?'}h${qualStr}`);
      }
    }

    // Treinos recentes
    if (workouts14.length > 0) {
      sections.push('\n--- TREINOS RECENTES ---');
      for (const w of workouts14) {
        const date = new Date(w.date).toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });
        const durStr = w.duration_m ? ` ${w.duration_m}min` : '';
        sections.push(`• ${date}: ${w.type}${durStr}`);
      }
    }

    // Substâncias 30 dias
    if (substStats30.length > 0) {
      sections.push('\n--- SUBSTÂNCIAS — 30 DIAS ---');
      for (const s of substStats30) {
        const qtyStr = s.total_quantity && s.unit ? ` — ${s.total_quantity}${s.unit}` : '';
        const costStr = s.total_cost ? ` (R$${s.total_cost.toFixed(2)})` : '';
        sections.push(`• ${s.substance}: ${s.days_used}/30 dias${qtyStr}${costStr}`);
      }
    }

    return sections.join('\n');
  } catch (_error) {
    return 'Saúde (histórico): indisponível';
  }
}
