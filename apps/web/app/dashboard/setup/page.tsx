'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DURATION, EASE } from '@/lib/animations/constants';
import { cn } from '@/lib/utils/cn';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Film,
  Heart,
  Home,
  Loader2,
  Package,
  Scale,
  Sparkles,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────

interface PersonalData {
  name: string;
  birthDate: string;
  timezone: string;
  bio: string;
  goals: string;
}

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface AgentInfo {
  id: string;
  emoji: string;
  name: string;
  description: string;
}

interface Preferences {
  checkinMorning: string;
  checkinEvening: string;
  weeklyReviewDay: string;
  weeklyReviewTime: string;
  enabledAgents: string[];
}

// ── Constants ──────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

const MODULES: ModuleInfo[] = [
  { id: 'finances', name: 'Financas', description: 'Transacoes, orcamentos, contas', icon: <Wallet className="h-5 w-5" /> },
  { id: 'health', name: 'Saude', description: 'Sono, treinos, medicoes', icon: <Heart className="h-5 w-5" /> },
  { id: 'people', name: 'Pessoas', description: 'Contactos, interacoes, rede', icon: <Users className="h-5 w-5" /> },
  { id: 'career', name: 'Carreira', description: 'Desenvolvimento, projectos', icon: <Briefcase className="h-5 w-5" /> },
  { id: 'objectives', name: 'Objectivos', description: 'Metas, progresso, KRs', icon: <Target className="h-5 w-5" /> },
  { id: 'routine', name: 'Rotina', description: 'Habitos, check-ins diarios', icon: <Clock className="h-5 w-5" /> },
  { id: 'assets', name: 'Patrimonio', description: 'Bens, documentos, inventario', icon: <Package className="h-5 w-5" /> },
  { id: 'entertainment', name: 'Entretenimento', description: 'Filmes, series, jogos, livros', icon: <Film className="h-5 w-5" /> },
  { id: 'legal', name: 'Juridico', description: 'Contratos, prazos, documentos', icon: <Scale className="h-5 w-5" /> },
  { id: 'housing', name: 'Moradia', description: 'Casa, manutencao, contas', icon: <Home className="h-5 w-5" /> },
  { id: 'calendar', name: 'Calendario', description: 'Eventos, lembretes, agenda', icon: <Calendar className="h-5 w-5" /> },
];

const DEFAULT_MODULES = ['finances', 'health', 'objectives', 'routine'];

const AGENTS: AgentInfo[] = [
  { id: 'bull', emoji: '\uD83D\uDC02', name: 'Bull', description: 'Financas, patrimonio, juridico' },
  { id: 'wolf', emoji: '\uD83D\uDC3A', name: 'Wolf', description: 'Saude, rotina, habitos' },
  { id: 'owl', emoji: '\uD83E\uDD89', name: 'Owl', description: 'Carreira, desenvolvimento' },
  { id: 'bee', emoji: '\uD83D\uDC1D', name: 'Bee', description: 'Agenda, produtividade' },
  { id: 'beaver', emoji: '\uD83E\uDDAB', name: 'Beaver', description: 'Moradia, seguranca' },
  { id: 'fox', emoji: '\uD83E\uDD8A', name: 'Fox', description: 'Entretenimento, social' },
  { id: 'peacock', emoji: '\uD83E\uDD9A', name: 'Peacock', description: 'Geracao de imagens' },
];

const WEEKDAYS = [
  { value: 'monday', label: 'Segunda' },
  { value: 'tuesday', label: 'Terca' },
  { value: 'wednesday', label: 'Quarta' },
  { value: 'thursday', label: 'Quinta' },
  { value: 'friday', label: 'Sexta' },
  { value: 'saturday', label: 'Sabado' },
  { value: 'sunday', label: 'Domingo' },
];

// ── Step indicator ─────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      {/* biome-ignore lint/suspicious/noArrayIndexKey: static step indicators */}
      {Array.from({ length: total }, (_, i) => (
        <div key={`step-${i}`} className="flex items-center gap-[var(--space-2)]">
          <motion.div
            className={cn(
              'h-2.5 rounded-full transition-colors duration-300',
              i === current
                ? 'bg-[var(--color-accent)]'
                : i < current
                  ? 'bg-[var(--color-accent-muted)]'
                  : 'bg-[var(--color-surface-3)]',
            )}
            animate={{ width: i === current ? 32 : 10 }}
            transition={{ duration: DURATION.normal, ease: EASE.outQuart as unknown as number[] }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Personal Data ──────────────────────────────────────

function StepPersonal({
  data,
  onChange,
}: {
  data: PersonalData;
  onChange: (data: PersonalData) => void;
}) {
  const initials = data.name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Dados Pessoais</h2>
        <p className="mt-[var(--space-1)] text-sm text-[var(--color-text-muted)]">
          Informacoes basicas para personalizar sua experiencia.
        </p>
      </div>

      {/* Avatar preview */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/20">
          {initials ? (
            <span className="text-2xl font-bold text-[var(--color-accent)]">{initials}</span>
          ) : (
            <Sparkles className="h-8 w-8 text-[var(--color-accent)]/60" />
          )}
        </div>
      </div>

      <div className="space-y-[var(--space-4)]">
        <div>
          <Label htmlFor="setup-name">Nome *</Label>
          <Input
            id="setup-name"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="Seu nome completo"
            className="mt-[var(--space-1-5)]"
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="setup-birth">Data de nascimento</Label>
          <Input
            id="setup-birth"
            type="date"
            value={data.birthDate}
            onChange={(e) => onChange({ ...data, birthDate: e.target.value })}
            className="mt-[var(--space-1-5)]"
          />
        </div>

        <div>
          <Label htmlFor="setup-tz">Fuso horario</Label>
          <div className="mt-[var(--space-1-5)]">
            <Select
              id="setup-tz"
              options={TIMEZONES}
              value={data.timezone}
              onChange={(e) => onChange({ ...data, timezone: e.target.value })}
              placeholder="Selecione o fuso horario"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="setup-bio">Bio</Label>
          <textarea
            id="setup-bio"
            value={data.bio}
            onChange={(e) => onChange({ ...data, bio: e.target.value.slice(0, 300) })}
            placeholder="Uma breve descricao sobre voce..."
            maxLength={300}
            rows={3}
            className="mt-[var(--space-1-5)] flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
          <p className="mt-[var(--space-1)] text-xs text-[var(--color-text-muted)] text-right">
            {data.bio.length}/300
          </p>
        </div>

        <div>
          <Label htmlFor="setup-goals">Objectivos</Label>
          <textarea
            id="setup-goals"
            value={data.goals}
            onChange={(e) => onChange({ ...data, goals: e.target.value.slice(0, 500) })}
            placeholder="O que deseja alcançar com o Hawk OS?"
            maxLength={500}
            rows={3}
            className="mt-[var(--space-1-5)] flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
          <p className="mt-[var(--space-1)] text-xs text-[var(--color-text-muted)] text-right">
            {data.goals.length}/500
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Module Selection ───────────────────────────────────

function StepModules({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (modules: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Modulos</h2>
        <p className="mt-[var(--space-1)] text-sm text-[var(--color-text-muted)]">
          Escolha quais areas deseja acompanhar. Pode alterar depois nas configuracoes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
        {MODULES.map((mod) => {
          const isActive = selected.includes(mod.id);
          return (
            <motion.button
              key={mod.id}
              type="button"
              onClick={() => toggle(mod.id)}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex items-start gap-[var(--space-3)] rounded-[var(--radius-lg)] border p-[var(--space-4)] text-left transition-all duration-200 cursor-pointer',
                isActive
                  ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8'
                  : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border)]',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-colors duration-200',
                  isActive
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]',
                )}
              >
                {mod.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-[var(--space-2)]">
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors duration-200',
                      isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]',
                    )}
                  >
                    {mod.name}
                  </span>
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                      isActive
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-[var(--color-border)]',
                    )}
                  >
                    {isActive && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {mod.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-text-muted)] text-center">
        {selected.length} de {MODULES.length} modulos selecionados
      </p>
    </div>
  );
}

// ── Step 3: Preferences ────────────────────────────────────────

function StepPreferences({
  prefs,
  onChange,
}: {
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
}) {
  const toggleAgent = (id: string) => {
    const agents = prefs.enabledAgents.includes(id)
      ? prefs.enabledAgents.filter((a) => a !== id)
      : [...prefs.enabledAgents, id];
    onChange({ ...prefs, enabledAgents: agents });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Preferencias</h2>
        <p className="mt-[var(--space-1)] text-sm text-[var(--color-text-muted)]">
          Configure horarios de check-in e agentes especializados.
        </p>
      </div>

      {/* Check-in times */}
      <div className="space-y-[var(--space-4)]">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Check-ins</h3>
        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div>
            <Label htmlFor="setup-morning">Matinal</Label>
            <Input
              id="setup-morning"
              type="time"
              value={prefs.checkinMorning}
              onChange={(e) => onChange({ ...prefs, checkinMorning: e.target.value })}
              className="mt-[var(--space-1-5)]"
            />
          </div>
          <div>
            <Label htmlFor="setup-evening">Noturno</Label>
            <Input
              id="setup-evening"
              type="time"
              value={prefs.checkinEvening}
              onChange={(e) => onChange({ ...prefs, checkinEvening: e.target.value })}
              className="mt-[var(--space-1-5)]"
            />
          </div>
        </div>
      </div>

      {/* Weekly review */}
      <div className="space-y-[var(--space-4)]">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Revisao Semanal</h3>
        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div>
            <Label htmlFor="setup-review-day">Dia</Label>
            <div className="mt-[var(--space-1-5)]">
              <Select
                id="setup-review-day"
                options={WEEKDAYS}
                value={prefs.weeklyReviewDay}
                onChange={(e) => onChange({ ...prefs, weeklyReviewDay: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="setup-review-time">Horario</Label>
            <Input
              id="setup-review-time"
              type="time"
              value={prefs.weeklyReviewTime}
              onChange={(e) => onChange({ ...prefs, weeklyReviewTime: e.target.value })}
              className="mt-[var(--space-1-5)]"
            />
          </div>
        </div>
      </div>

      {/* Agent selection */}
      <div className="space-y-[var(--space-4)]">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Agentes Especializados</h3>
          <p className="mt-[var(--space-1)] text-xs text-[var(--color-text-muted)]">
            Agentes que irao auxiliar em areas especificas.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
          {AGENTS.map((agent) => {
            const isActive = prefs.enabledAgents.includes(agent.id);
            return (
              <div
                key={agent.id}
                className={cn(
                  'flex items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border p-[var(--space-3)] transition-all duration-200',
                  isActive
                    ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8'
                    : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]',
                )}
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {agent.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]',
                    )}
                  >
                    {agent.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{agent.description}</p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={() => toggleAgent(agent.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────

const STEP_TITLES = ['Dados Pessoais', 'Modulos', 'Preferencias'];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [personal, setPersonal] = useState<PersonalData>({
    name: '',
    birthDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    bio: '',
    goals: '',
  });

  // Step 2 state
  const [enabledModules, setEnabledModules] = useState<string[]>([...DEFAULT_MODULES]);

  // Step 3 state
  const [preferences, setPreferences] = useState<Preferences>({
    checkinMorning: '09:00',
    checkinEvening: '22:00',
    weeklyReviewDay: 'sunday',
    weeklyReviewTime: '20:00',
    enabledAgents: ['bull', 'wolf', 'owl', 'bee'],
  });

  const canProceed = step === 0 ? personal.name.trim().length > 0 : true;
  const isLastStep = step === STEP_TITLES.length - 1;

  const goNext = useCallback(() => {
    if (isLastStep) return;
    setDirection(1);
    setStep((s) => s + 1);
    setError(null);
  }, [isLastStep]);

  const goBack = useCallback(() => {
    if (step === 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
    setError(null);
  }, [step]);

  const handleComplete = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const body = {
        name: personal.name.trim(),
        birthDate: personal.birthDate || undefined,
        timezone: personal.timezone || undefined,
        bio: personal.bio.trim() || undefined,
        goals: personal.goals.trim() || undefined,
        checkinMorning: preferences.checkinMorning,
        checkinEvening: preferences.checkinEvening,
        weeklyReviewDay: preferences.weeklyReviewDay,
        weeklyReviewTime: preferences.weeklyReviewTime,
        enabledModules,
        enabledAgents: preferences.enabledAgents,
      };

      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || 'Erro ao salvar configuracao. Tente novamente.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Erro de conexao. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }, [personal, preferences, enabledModules, router]);

  // Animation variants for step transitions
  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height))] items-start justify-center py-[var(--space-8)] px-[var(--space-4)]">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE.outQuart as unknown as number[] }}
          className="mb-[var(--space-8)] text-center"
        >
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Configuracao Inicial
          </h1>
          <p className="mt-[var(--space-2)] text-sm text-[var(--color-text-muted)]">
            {STEP_TITLES[step]} — Passo {step + 1} de {STEP_TITLES.length}
          </p>
          <div className="mt-[var(--space-4)] flex justify-center">
            <StepIndicator current={step} total={STEP_TITLES.length} />
          </div>
        </motion.div>

        {/* Card */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] shadow-[var(--shadow-md)]">
          <div className="p-[var(--space-6)] sm:p-[var(--space-8)]">
            {/* Step content with animation */}
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: DURATION.normal, ease: EASE.outQuart as unknown as number[] }}
                >
                  {step === 0 && <StepPersonal data={personal} onChange={setPersonal} />}
                  {step === 1 && <StepModules selected={enabledModules} onChange={setEnabledModules} />}
                  {step === 2 && <StepPreferences prefs={preferences} onChange={setPreferences} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-[var(--space-4)] overflow-hidden"
                >
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-[var(--space-3)] py-[var(--space-2)]">
                    <p className="text-xs text-[var(--color-danger)]">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer with navigation */}
          <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] px-[var(--space-6)] py-[var(--space-4)] sm:px-[var(--space-8)]">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 0 || submitting}
              className={cn(step === 0 && 'invisible')}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>

            {isLastStep ? (
              <Button onClick={handleComplete} disabled={submitting || !canProceed}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Concluir
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canProceed}>
                Proximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-[var(--space-4)] text-center text-xs text-[var(--color-text-muted)] opacity-60"
        >
          Tudo pode ser alterado depois em Configuracoes.
        </motion.p>
      </div>
    </div>
  );
}
