'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EditSheet } from '@/components/ui/edit-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { MentionInput } from '@/components/ui/mention-input';
import { MentionText } from '@/components/ui/mention-text';
import { Select } from '@/components/ui/select';
import { addInteraction, editPerson, fetchPersonDetail } from '@/lib/actions/people';
import { cn } from '@/lib/utils/cn';
import { formatRelativeDay } from '@/lib/utils/format';
import type {
  ContactFrequency,
  InteractionChannel,
  InteractionSentiment,
  InteractionType,
  Relationship,
  UpdatePersonInput,
} from '@hawk/module-people/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Cake, Mail, MapPin, MessageSquare, Pencil, Phone, Star } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const REL_LABELS: Record<Relationship, string> = {
  family: 'Família',
  friend: 'Amigo',
  colleague: 'Colega',
  romantic: 'Romântico',
  professional: 'Profissional',
  medical: 'Médico',
};
const REL_COLORS: Record<Relationship, string> = {
  family: 'var(--color-danger)',
  friend: 'var(--color-success)',
  colleague: 'var(--color-accent)',
  romantic: 'var(--color-mod-people)',
  professional: 'var(--color-mod-career)',
  medical: 'var(--color-mod-health)',
};
const FREQ_LABELS: Record<ContactFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  as_needed: 'Sob demanda',
};

const RELATIONSHIP_OPTIONS: Array<{ value: Relationship; label: string }> = [
  { value: 'family', label: 'Família' },
  { value: 'friend', label: 'Amigo' },
  { value: 'colleague', label: 'Colega' },
  { value: 'romantic', label: 'Romântico' },
  { value: 'professional', label: 'Profissional' },
  { value: 'medical', label: 'Médico' },
];

type Props = { personId: string; onBack: () => void };

export function PersonProfile({ personId, onBack }: Props) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editFields, setEditFields] = useState<UpdatePersonInput>({});

  const { data: person } = useQuery({
    queryKey: ['people', 'detail', personId],
    queryFn: () => fetchPersonDetail(personId),
  });

  const editMutation = useMutation({
    mutationFn: (input: UpdatePersonInput) => editPerson(personId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setEditOpen(false);
      toast.success('Contato atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  if (!person) return null;

  const rel = person.relationship as Relationship | null;
  const relColor = rel ? REL_COLORS[rel] : 'var(--color-text-muted)';

  function openEdit() {
    setEditFields({
      name: person?.name ?? '',
      relationship: (person?.relationship as Relationship) ?? undefined,
      phone: person?.phone ?? '',
      email: person?.email ?? '',
      city: person?.city ?? '',
      importance: person?.importance ?? 5,
      notes: person?.notes ?? '',
      birthday: person?.birthday ?? '',
      role: person?.role ?? '',
    });
    setEditOpen(true);
  }

  return (
    <div className="space-y-[var(--space-5)]">
      {/* Edit Sheet */}
      <EditSheet open={editOpen} onClose={() => setEditOpen(false)} title="Editar contato">
        <div className="space-y-[var(--space-3)]">
          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Nome
            </label>
            <input
              type="text"
              value={editFields.name ?? ''}
              onChange={(e) => setEditFields((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Relacionamento
            </label>
            <Select
              value={editFields.relationship ?? ''}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, relationship: e.target.value as Relationship }))
              }
              placeholder="Selecionar"
              size="sm"
              options={RELATIONSHIP_OPTIONS}
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Cargo / Papel
            </label>
            <input
              type="text"
              value={editFields.role ?? ''}
              onChange={(e) => setEditFields((p) => ({ ...p, role: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Telefone
            </label>
            <input
              type="tel"
              value={editFields.phone ?? ''}
              onChange={(e) => setEditFields((p) => ({ ...p, phone: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={editFields.email ?? ''}
              onChange={(e) => setEditFields((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Cidade
            </label>
            <input
              type="text"
              value={editFields.city ?? ''}
              onChange={(e) => setEditFields((p) => ({ ...p, city: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Aniversário
            </label>
            <input
              type="date"
              value={editFields.birthday ?? ''}
              onChange={(e) => setEditFields((p) => ({ ...p, birthday: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Importância: {editFields.importance ?? 5}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={editFields.importance ?? 5}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, importance: Number.parseInt(e.target.value, 10) }))
              }
              className="w-full accent-[var(--color-mod-people)]"
            />
          </div>

          <div className="space-y-[var(--space-1)]">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Notas
            </label>
            <textarea
              value={editFields.notes ?? ''}
              onChange={(e) => setEditFields((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => editMutation.mutate(editFields)}
            disabled={!editFields.name?.trim() || editMutation.isPending}
          >
            Salvar alterações
          </Button>
        </div>
      </EditSheet>

      {/* Header */}
      <div className="flex items-start gap-[var(--space-4)]">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer mt-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-[var(--space-3)]">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold"
              style={{ background: `${relColor}20`, color: relColor }}
            >
              {person.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {person.name}
              </h2>
              <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-0-5)]">
                {rel && (
                  <Badge style={{ background: `${relColor}20`, color: relColor }}>
                    {REL_LABELS[rel]}
                  </Badge>
                )}
                {person.role && (
                  <span className="text-xs text-[var(--color-text-muted)]">{person.role}</span>
                )}
                {person.importance >= 8 && (
                  <Star className="h-3.5 w-3.5 text-[var(--color-warning)] fill-[var(--color-warning)]" />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={openEdit}
              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
              title="Editar contato"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-[var(--space-6)] items-start">
        {/* Left: Info + Timeline */}
        <div className="flex-1 min-w-0 space-y-[var(--space-5)]">
          {/* Contact info bar */}
          <div className="flex flex-wrap gap-[var(--space-4)] text-xs text-[var(--color-text-secondary)]">
            {person.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-[var(--color-text-muted)]" />
                {person.phone}
              </span>
            )}
            {person.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-[var(--color-text-muted)]" />
                {person.email}
              </span>
            )}
            {person.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[var(--color-text-muted)]" />
                {person.city}
              </span>
            )}
            {person.birthday && (
              <span className="flex items-center gap-1">
                <Cake className="h-3 w-3 text-[var(--color-text-muted)]" />
                {new Date(`${person.birthday}T12:00:00`).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                })}
              </span>
            )}
          </div>

          {/* Notes */}
          {person.notes && (
            <p className="text-sm text-[var(--color-text-muted)] italic border-l-2 border-[var(--color-border)] pl-[var(--space-3)]">
              {person.notes}
            </p>
          )}

          {/* Interaction timeline */}
          <div>
            <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Histórico ({person.interactions.length})
            </span>
            <div className="mt-[var(--space-2)] space-y-[var(--space-1)]">
              {person.interactions.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Nenhuma interação registrada"
                  description="Registre interações com esta pessoa"
                />
              ) : (
                person.interactions.map((inter) => (
                  <div
                    key={inter.id}
                    className="flex items-start gap-[var(--space-3)] py-[var(--space-2)] border-l-2 border-[var(--color-border-subtle)] pl-[var(--space-3)] ml-[var(--space-1)]"
                  >
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 -ml-[calc(var(--space-3)+5px)]',
                        inter.sentiment === 'positive'
                          ? 'bg-[var(--color-success)]'
                          : inter.sentiment === 'negative'
                            ? 'bg-[var(--color-danger)]'
                            : 'bg-[var(--color-surface-4)]',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Badge variant="muted">{inter.type}</Badge>
                        {inter.channel && (
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {inter.channel}
                          </span>
                        )}
                        {inter.duration_minutes && (
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {inter.duration_minutes}min
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                          {formatRelativeDay(inter.date)}
                        </span>
                      </div>
                      {inter.summary && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-[var(--space-0-5)]">
                          <MentionText text={inter.summary} />
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Stats + Quick Log */}
        <div className="w-64 flex-shrink-0 hidden lg:block space-y-[var(--space-4)]">
          {/* Status */}
          <div className="space-y-[var(--space-2)]">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-[var(--color-text-muted)]">Último contato</span>
              <span
                className={cn(
                  'text-xs font-mono',
                  person.overdue_contact
                    ? 'text-[var(--color-danger)]'
                    : 'text-[var(--color-text-primary)]',
                )}
              >
                {person.days_since_contact !== null
                  ? `${person.days_since_contact}d atrás`
                  : 'nunca'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-[var(--color-text-muted)]">Frequência</span>
              <span className="text-xs text-[var(--color-text-primary)]">
                {person.contact_frequency
                  ? FREQ_LABELS[person.contact_frequency as ContactFrequency]
                  : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-[var(--color-text-muted)]">Importância</span>
              <span className="text-xs font-mono text-[var(--color-text-primary)]">
                {person.importance}/10
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-[var(--color-text-muted)]">Interações</span>
              <span className="text-xs font-mono text-[var(--color-text-primary)]">
                {person.interactions.length}
              </span>
            </div>
          </div>

          {/* Quick log */}
          <QuickLog
            personId={personId}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['people'] })}
          />
        </div>
      </div>
    </div>
  );
}

function QuickLog({ personId, onSuccess }: { personId: string; onSuccess: () => void }) {
  const [type, setType] = useState<InteractionType>('message');
  const [channel, _setChannel] = useState<InteractionChannel>('whatsapp');
  const [summary, setSummary] = useState('');
  const [sentiment, setSentiment] = useState<InteractionSentiment>('neutral');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      addInteraction({
        person_id: personId,
        type,
        channel,
        summary: summary || undefined,
        sentiment,
      }),
    onSuccess: () => {
      setSummary('');
      queryClient.invalidateQueries({ queryKey: ['people'] });
      onSuccess();
    },
  });

  const typeOpts: Array<{ value: InteractionType; label: string }> = [
    { value: 'message', label: 'Msg' },
    { value: 'call', label: 'Lig.' },
    { value: 'meeting', label: 'Reun.' },
    { value: 'visit', label: 'Visita' },
    { value: 'email', label: 'Email' },
  ];

  return (
    <Card>
      <CardContent className="pt-[var(--space-3)] space-y-[var(--space-2)]">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Registrar
        </span>

        <div className="flex gap-[var(--space-0-5)] flex-wrap">
          {typeOpts.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                'px-[var(--space-2)] py-[var(--space-0-5)] rounded-[var(--radius-sm)] text-[11px] font-medium cursor-pointer transition-colors',
                type === t.value
                  ? 'bg-[var(--color-accent)] text-[var(--color-surface-0)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <MentionInput
          value={summary}
          onChange={setSummary}
          placeholder="Notas (opcional, @ para mencionar)"
          rows={2}
        />

        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex gap-[var(--space-1)]">
            {(['positive', 'neutral', 'negative'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSentiment(s)}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] cursor-pointer transition-colors',
                  sentiment === s
                    ? s === 'positive'
                      ? 'bg-[var(--color-success)] text-white'
                      : s === 'negative'
                        ? 'bg-[var(--color-danger)] text-white'
                        : 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]',
                )}
              >
                {s === 'positive' ? '+' : s === 'negative' ? '−' : '○'}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
