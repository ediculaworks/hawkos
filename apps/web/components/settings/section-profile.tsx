'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProfileData } from '@/lib/actions/settings';
import { updateProfileSettings } from '@/lib/actions/settings';
import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SectionProfileProps {
  profile: ProfileData;
  onSaved: () => void;
}

const WEEKDAYS = [
  { value: 'sunday', label: 'Domingo' },
  { value: 'monday', label: 'Segunda' },
  { value: 'tuesday', label: 'Terça' },
  { value: 'wednesday', label: 'Quarta' },
  { value: 'thursday', label: 'Quinta' },
  { value: 'friday', label: 'Sexta' },
  { value: 'saturday', label: 'Sábado' },
];

function meta(profile: ProfileData, key: string, fallback: string): string {
  return (profile.metadata[key] as string) ?? fallback;
}

export function SectionProfile({ profile, onSaved }: SectionProfileProps) {
  const [bio, setBio] = useState(meta(profile, 'bio', ''));
  const [goals, setGoals] = useState(meta(profile, 'goals_summary', ''));
  const [checkinMorning, setCheckinMorning] = useState(meta(profile, 'checkin_morning', '09:00'));
  const [checkinEvening, setCheckinEvening] = useState(meta(profile, 'checkin_evening', '22:00'));
  const [weeklyDay, setWeeklyDay] = useState(meta(profile, 'weekly_review_day', 'sunday'));
  const [weeklyTime, setWeeklyTime] = useState(meta(profile, 'weekly_review_time', '20:00'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBio(meta(profile, 'bio', ''));
    setGoals(meta(profile, 'goals_summary', ''));
    setCheckinMorning(meta(profile, 'checkin_morning', '09:00'));
    setCheckinEvening(meta(profile, 'checkin_evening', '22:00'));
    setWeeklyDay(meta(profile, 'weekly_review_day', 'sunday'));
    setWeeklyTime(meta(profile, 'weekly_review_time', '20:00'));
  }, [profile]);

  const isDirty =
    bio !== meta(profile, 'bio', '') ||
    goals !== meta(profile, 'goals_summary', '') ||
    checkinMorning !== meta(profile, 'checkin_morning', '09:00') ||
    checkinEvening !== meta(profile, 'checkin_evening', '22:00') ||
    weeklyDay !== meta(profile, 'weekly_review_day', 'sunday') ||
    weeklyTime !== meta(profile, 'weekly_review_time', '20:00');

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfileSettings({
      name: profile.name,
      birth_date: profile.birth_date,
      metadata: {
        bio,
        goals_summary: goals,
        checkin_morning: checkinMorning,
        checkin_evening: checkinEvening,
        weekly_review_day: weeklyDay,
        weekly_review_time: weeklyTime,
      },
    });
    setSaving(false);
    if (result.success) {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const selectClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]';

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Perfil</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Conte ao agente sobre você e configure os horários de check-in.
        </p>
      </div>

      <div className="space-y-[var(--space-5)] max-w-lg">
        <div className="grid gap-[var(--space-2)]">
          <Label htmlFor="prof_bio">Bio</Label>
          <textarea
            id="prof_bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Conte um pouco sobre você para o agente..."
            className={`${selectClass} resize-none`}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            O agente usa isso para personalizar interações.
          </p>
        </div>

        <div className="grid gap-[var(--space-2)]">
          <Label htmlFor="prof_goals">Objetivos atuais</Label>
          <textarea
            id="prof_goals"
            rows={3}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="Quais são seus objetivos de vida atuais?"
            className={`${selectClass} resize-none`}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Aparece no contexto do agente para alinhar sugestões.
          </p>
        </div>

        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Horários de check-in
          </h3>
          <div className="grid grid-cols-2 gap-[var(--space-4)]">
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="prof_morning">Manhã</Label>
              <Input
                id="prof_morning"
                type="time"
                value={checkinMorning}
                onChange={(e) => setCheckinMorning(e.target.value)}
              />
            </div>
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="prof_evening">Noite</Label>
              <Input
                id="prof_evening"
                type="time"
                value={checkinEvening}
                onChange={(e) => setCheckinEvening(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Weekly review
          </h3>
          <div className="grid grid-cols-2 gap-[var(--space-4)]">
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="prof_wday">Dia</Label>
              <select
                id="prof_wday"
                value={weeklyDay}
                onChange={(e) => setWeeklyDay(e.target.value)}
                className={selectClass}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="prof_wtime">Horário</Label>
              <Input
                id="prof_wtime"
                type="time"
                value={weeklyTime}
                onChange={(e) => setWeeklyTime(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-[var(--space-4)]">
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
