'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchDailySummary } from '@/lib/actions/health';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Brain, Moon, Scale, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

function calcSleepScore(hours: number | null, quality: number | null): number {
  if (hours === null) return 0;
  const target = 8;
  const hoursScore = Math.min(hours / target, 1.25) * 40;
  const qualityScore = ((quality ?? 0) / 10) * 20;
  return Math.min(hoursScore + qualityScore, 60);
}

function calcWorkoutScore(exercised: boolean, minutes: number | null): number {
  if (!exercised) return 0;
  const target = 60;
  const score = Math.min(((minutes ?? 0) / target) * 40, 40);
  return score;
}

function calcMoodScore(mood: number | null, energy: number | null): number {
  const moodScore = ((mood ?? 0) / 10) * 30;
  const energyScore = ((energy ?? 0) / 10) * 10;
  return moodScore + energyScore;
}

function calcMedsScore(taken: number | null, skipped: number | null): number {
  const t = taken ?? 0;
  const s = skipped ?? 0;
  const total = t + s;
  if (total === 0) return 20;
  return Math.round((t / total) * 20);
}

function calcCannabisPenalty(g: number | null): number {
  if (g === null || g === 0) return 0;
  if (g <= 1) return 5;
  if (g <= 2) return 10;
  return 15;
}

function calcTobaccoPenalty(qty: number | null): number {
  if (qty === null || qty === 0) return 0;
  if (qty <= 1) return 3;
  return 7;
}

function ScoreBar({ score, maxScore, color }: { score: number; maxScore: number; color: string }) {
  const raw = (score / maxScore) * 100;
  const pct = Number.isNaN(raw) ? 0 : Math.min(raw, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-[var(--color-text-muted)] w-8 text-right">
        {Number.isNaN(score) ? '0' : score.toFixed(0)}
      </span>
    </div>
  );
}

export function HealthScore() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['health', 'daily-summary'],
    queryFn: fetchDailySummary,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-24 bg-[var(--color-surface-2)] rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const sleepScore = calcSleepScore(summary.sleep_hours, summary.sleep_quality);
  const workoutScore = calcWorkoutScore(summary.exercised, summary.workout_min);
  const moodScore = calcMoodScore(summary.mood, summary.energy);
  const medsScore = calcMedsScore(summary.meds_taken, summary.meds_skipped);
  const cannabisPenalty = calcCannabisPenalty(summary.cannabis_g);
  const tobaccoPenalty = calcTobaccoPenalty(summary.tobacco_qty);

  const rawScore = sleepScore + workoutScore + moodScore + medsScore;
  const penalties = cannabisPenalty + tobaccoPenalty;
  const totalScore = Math.max(0, Math.min(100, Math.round(rawScore - penalties)));

  const scoreColor =
    totalScore >= 70
      ? 'var(--color-success)'
      : totalScore >= 45
        ? 'var(--color-warning)'
        : 'var(--color-danger)';

  const alerts: { icon: React.ReactNode; text: string; severity: 'warning' | 'danger' }[] = [];

  if (summary.cannabis_g !== null && summary.cannabis_g > 2) {
    alerts.push({
      icon: <AlertTriangle className="h-3 w-3" />,
      text: `Uso elevado de cannabis (${summary.cannabis_g}g)`,
      severity: 'warning',
    });
  }
  if (summary.sleep_hours !== null && summary.sleep_hours < 6) {
    alerts.push({
      icon: <Moon className="h-3 w-3" />,
      text: `Sono curto (${summary.sleep_hours.toFixed(1)}h)`,
      severity: 'danger',
    });
  }
  if (summary.exercised && summary.workout_min !== null && summary.workout_min < 30) {
    alerts.push({
      icon: <Zap className="h-3 w-3" />,
      text: `Treino curto (${summary.workout_min}min)`,
      severity: 'warning',
    });
  }
  if (
    summary.cannabis_g !== null &&
    summary.cannabis_g > 2 &&
    summary.sleep_hours !== null &&
    summary.sleep_hours < 6
  ) {
    alerts.push({
      icon: <AlertTriangle className="h-3 w-3" />,
      text: 'Correlação: cannabis + sono curto podem estar conectados',
      severity: 'danger',
    });
  }
  if ((summary.meds_skipped ?? 0) > 0) {
    alerts.push({
      icon: <Activity className="h-3 w-3" />,
      text: `${summary.meds_skipped} medicamento(s) não tomado(s)`,
      severity: 'warning',
    });
  }

  const handleScoreToast = () => {
    toast.success(`Score do dia: ${totalScore}/100 — ${getScoreMessage(totalScore)}`, {
      duration: 4000,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Score do Dia
          </CardTitle>
          <button
            type="button"
            onClick={handleScoreToast}
            title="Ver breakdown"
            className="text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: scoreColor }}
          >
            {totalScore}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <Moon className="h-3 w-3" /> Sono
            </span>
            <span>/60</span>
          </div>
          <ScoreBar score={sleepScore} maxScore={60} color="var(--color-mod-health)" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> Treino
            </span>
            <span>/40</span>
          </div>
          <ScoreBar score={workoutScore} maxScore={40} color="var(--color-success)" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <Brain className="h-3 w-3" /> Humor + Energia
            </span>
            <span>/40</span>
          </div>
          <ScoreBar score={moodScore} maxScore={40} color="var(--color-accent)" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <Scale className="h-3 w-3" /> Adesão meds
            </span>
            <span>/20</span>
          </div>
          <ScoreBar score={medsScore} maxScore={20} color="var(--color-warning)" />
        </div>

        {penalties > 0 && (
          <div className="pt-1 border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between text-[11px] text-[var(--color-danger)]">
              <span>Penalidades</span>
              <span>-{penalties}</span>
            </div>
            <div className="h-1 bg-[var(--color-danger)]/30 rounded-full mt-1">
              <div
                className="h-full bg-[var(--color-danger)] rounded-full"
                style={{ width: `${Math.min((penalties / 30) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-1">
            {alerts.map((alert) => (
              <div
                key={alert.text}
                className={`flex items-center gap-[var(--space-1)] text-[11px] px-2 py-1 rounded-[var(--radius-sm)] ${
                  alert.severity === 'danger'
                    ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                    : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                }`}
              >
                {alert.icon}
                <span>{alert.text}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getScoreMessage(score: number): string {
  if (score >= 80) return 'Excelente! Continue assim.';
  if (score >= 60) return 'Bom dia. Pode melhorar.';
  if (score >= 40) return 'Dia moderado. Cuide-se.';
  return 'Dia difícil. Tente descansar.';
}
