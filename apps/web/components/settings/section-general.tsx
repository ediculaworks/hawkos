'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ProfileData } from '@/lib/actions/settings';
import { updateProfileSettings } from '@/lib/actions/settings';
import { Globe, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SectionGeneralProps {
  profile: ProfileData;
  onSaved: () => void;
}

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
];

const LANGUAGES = [
  { value: 'pt-BR', label: 'Portugues (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es', label: 'Espanol' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const TIME_FORMATS = [
  { value: '24h', label: '24 horas' },
  { value: '12h', label: '12 horas (AM/PM)' },
];

export function SectionGeneral({ profile, onSaved }: SectionGeneralProps) {
  const [timezone, setTimezone] = useState(
    (profile.metadata.timezone as string) ?? 'America/Sao_Paulo',
  );
  const [language, setLanguage] = useState((profile.metadata.language as string) ?? 'pt-BR');
  const [dateFormat, setDateFormat] = useState(
    (profile.metadata.date_format as string) ?? 'DD/MM/YYYY',
  );
  const [timeFormat, setTimeFormat] = useState((profile.metadata.time_format as string) ?? '24h');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTimezone((profile.metadata.timezone as string) ?? 'America/Sao_Paulo');
    setLanguage((profile.metadata.language as string) ?? 'pt-BR');
    setDateFormat((profile.metadata.date_format as string) ?? 'DD/MM/YYYY');
    setTimeFormat((profile.metadata.time_format as string) ?? '24h');
  }, [profile]);

  const isDirty =
    timezone !== ((profile.metadata.timezone as string) ?? 'America/Sao_Paulo') ||
    language !== ((profile.metadata.language as string) ?? 'pt-BR') ||
    dateFormat !== ((profile.metadata.date_format as string) ?? 'DD/MM/YYYY') ||
    timeFormat !== ((profile.metadata.time_format as string) ?? '24h');

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfileSettings({
      name: profile.name,
      birth_date: profile.birth_date,
      metadata: { timezone, language, date_format: dateFormat, time_format: timeFormat },
    });
    setSaving(false);
    if (result.success) {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const selectClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 transition-colors';

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
          <Globe className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Geral</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Preferencias regionais e de formato.
        </p>
      </div>

      <div className="space-y-[var(--space-5)] max-w-lg">
        {/* Timezone */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-[var(--space-4)]">
          <div className="grid gap-[var(--space-2)]">
            <Label htmlFor="gen_tz">Fuso horario</Label>
            <select
              id="gen_tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={selectClass}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-[var(--space-2)]">
            <Label htmlFor="gen_lang">Idioma</Label>
            <select
              id="gen_lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={selectClass}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date/Time formats */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Formatos
          </h3>
          <div className="grid grid-cols-2 gap-[var(--space-4)]">
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="gen_datefmt">Data</Label>
              <select
                id="gen_datefmt"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className={selectClass}
              >
                {DATE_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="gen_timefmt">Hora</Label>
              <select
                id="gen_timefmt"
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className={selectClass}
              >
                {TIME_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-3)]">
            Exemplo:{' '}
            {dateFormat === 'DD/MM/YYYY'
              ? '04/04/2026'
              : dateFormat === 'MM/DD/YYYY'
                ? '04/04/2026'
                : '2026-04-04'}{' '}
            {timeFormat === '24h' ? '14:30' : '2:30 PM'}
          </p>
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
