'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProfileData } from '@/lib/actions/settings';
import { updateProfileSettings } from '@/lib/actions/settings';
import { Loader2, Save, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SectionProfileProps {
  profile: ProfileData;
  onSaved: () => void;
}

function meta(profile: ProfileData, key: string, fallback: string): string {
  return (profile.metadata[key] as string) ?? fallback;
}

export function SectionProfile({ profile, onSaved }: SectionProfileProps) {
  const [name, setName] = useState(profile.name);
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '');
  const [bio, setBio] = useState(meta(profile, 'bio', ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setBirthDate(profile.birth_date ?? '');
    setBio(meta(profile, 'bio', ''));
  }, [profile]);

  const isDirty =
    name !== profile.name ||
    birthDate !== (profile.birth_date ?? '') ||
    bio !== meta(profile, 'bio', '');

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfileSettings({
      name,
      birth_date: birthDate || null,
      metadata: { bio },
    });
    setSaving(false);
    if (result.success) {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  // Calculate age from birth date
  const age = birthDate
    ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
          <UserCircle className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Perfil</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Informacoes pessoais usadas pelo agente para personalizar interacoes.
        </p>
      </div>

      <div className="space-y-[var(--space-5)] max-w-lg">
        {/* Avatar placeholder + Name */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <div className="flex items-start gap-[var(--space-4)]">
            {/* Avatar circle */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/60 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-white">
                {name ? name.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <div className="flex-1 space-y-[var(--space-3)]">
              <div className="grid gap-[var(--space-2)]">
                <Label htmlFor="prof_name">Nome</Label>
                <Input
                  id="prof_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div className="grid gap-[var(--space-2)]">
                <Label htmlFor="prof_birth">Data de nascimento</Label>
                <div className="flex items-center gap-[var(--space-3)]">
                  <Input
                    id="prof_birth"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="flex-1"
                  />
                  {age !== null && age > 0 && (
                    <span className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">
                      {age} anos
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <div className="grid gap-[var(--space-2)]">
            <Label htmlFor="prof_bio">Bio</Label>
            <textarea
              id="prof_bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre voce para o agente..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 transition-colors"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              O agente usa isso para personalizar respostas e sugestoes.
            </p>
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
