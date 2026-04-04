'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TIMEZONES } from '@/lib/onboarding/types';
import { formatCPF, step2Schema, validateCPF } from '@/lib/onboarding/validation';
import { useState } from 'react';

interface Step2ProfileProps {
  onNext: (data: { name: string; cpf: string; birthDate: string; timezone: string }) => void;
  onBack: () => void;
  initialValues?: { name?: string; cpf?: string; birthDate?: string; timezone?: string };
}

export function Step2Profile({ onNext, onBack, initialValues }: Step2ProfileProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [cpf, setCpf] = useState(initialValues?.cpf ?? '');
  const [birthDate, setBirthDate] = useState(initialValues?.birthDate ?? '');
  const [timezone, setTimezone] = useState(initialValues?.timezone ?? 'America/Sao_Paulo');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setCpf(formatted);
  };

  const handleSubmit = () => {
    const result = step2Schema.safeParse({ name, cpf, birthDate, timezone });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      for (const err of result.error.issues) {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      }
      setErrors(newErrors);
      return;
    }

    if (!validateCPF(cpf)) {
      setErrors({ cpf: 'CPF inválido' });
      return;
    }

    setErrors({});
    onNext({ name, cpf, birthDate, timezone });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Dados Pessoais</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Esses dados são usados para personalizar sua experiência.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="profile-name"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Nome Completo
          </label>
          <Input
            id="profile-name"
            placeholder="João Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="text-xs text-[var(--color-danger)] mt-1">{errors.name}</p>}
        </div>

        <div>
          <label
            htmlFor="profile-cpf"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            CPF
          </label>
          <Input
            id="profile-cpf"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => handleCPFChange(e.target.value)}
            maxLength={14}
          />
          {errors.cpf && <p className="text-xs text-[var(--color-danger)] mt-1">{errors.cpf}</p>}
        </div>

        <div>
          <label
            htmlFor="profile-birthdate"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Data de Nascimento
          </label>
          <Input
            id="profile-birthdate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          {errors.birthDate && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.birthDate}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="profile-timezone"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Timezone
          </label>
          <select
            id="profile-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
          {errors.timezone && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.timezone}</p>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          ℹ️ Seus dados são protegidos e usados apenas para personalizar sua experiência no sistema.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          ← Voltar
        </Button>
        <Button onClick={handleSubmit} disabled={!name || !cpf || !birthDate || !timezone}>
          Próximo →
        </Button>
      </div>
    </div>
  );
}
