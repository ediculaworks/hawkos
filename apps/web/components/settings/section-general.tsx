'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProfileData } from '@/lib/actions/settings';
import { updateProfileSettings } from '@/lib/actions/settings';
import { Loader2, Save } from 'lucide-react';
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
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
];

const LANGUAGES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es', label: 'Español' },
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
  const [name, setName] = useState(profile.name);
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '');
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

  // Reset form when profile changes
  useEffect(() => {
    setName(profile.name);
    setBirthDate(profile.birth_date ?? '');
    setTimezone((profile.metadata.timezone as string) ?? 'America/Sao_Paulo');
    setLanguage((profile.metadata.language as string) ?? 'pt-BR');
    setDateFormat((profile.metadata.date_format as string) ?? 'DD/MM/YYYY');
    setTimeFormat((profile.metadata.time_format as string) ?? '24h');
  }, [profile]);

  const isDirty =
    name !== profile.name ||
    birthDate !== (profile.birth_date ?? '') ||
    timezone !== ((profile.metadata.timezone as string) ?? 'America/Sao_Paulo') ||
    language !== ((profile.metadata.language as string) ?? 'pt-BR') ||
    dateFormat !== ((profile.metadata.date_format as string) ?? 'DD/MM/YYYY') ||
    timeFormat !== ((profile.metadata.time_format as string) ?? '24h');

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfileSettings({
      name,
      birth_date: birthDate || null,
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
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]';

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Geral</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Informações básicas e preferências de formato.
        </p>
      </div>

      <div className="space-y-[var(--space-5)] max-w-lg">
        <div className="grid gap-[var(--space-2)]">
          <Label htmlFor="gen_name">Nome</Label>
          <Input
            id="gen_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        <div className="grid gap-[var(--space-2)]">
          <Label htmlFor="gen_birth">Data de nascimento</Label>
          <Input
            id="gen_birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        <div className="grid gap-[var(--space-2)]">
          <Label htmlFor="gen_tz">Timezone</Label>
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

        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div className="grid gap-[var(--space-2)]">
            <Label htmlFor="gen_datefmt">Formato de data</Label>
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
            <Label htmlFor="gen_timefmt">Formato de hora</Label>
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
