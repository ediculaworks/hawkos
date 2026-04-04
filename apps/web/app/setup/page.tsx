'use client';

import { ChatInput } from '@/components/chat/chat-input';
import { MarkdownRenderer } from '@/components/chat/markdown-renderer';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Constants ─────────────────────────────────────────────────────

const ALL_MODULES = [
  'finances', 'health', 'people', 'career', 'objectives', 'routine',
  'assets', 'entertainment', 'legal', 'housing', 'calendar',
];
const ALL_AGENTS = ['bull', 'wolf', 'owl', 'bee', 'beaver', 'fox', 'peacock'];
const LS_KEY = 'hawk_onboarding';
const AFFIRM = new Set([
  'sim', 's', 'yes', 'y', 'ok', 'certo', 'correto', 'confirmar',
  'confirmo', 'claro', 'exato', 'isso', 'pode ser', 'tá', 'ta',
]);
const WEEKDAY_MAP: Record<string, string> = {
  domingo: 'sunday', dom: 'sunday', sunday: 'sunday',
  segunda: 'monday', seg: 'monday', monday: 'monday',
  terca: 'tuesday', terça: 'tuesday', ter: 'tuesday', tuesday: 'tuesday',
  quarta: 'wednesday', qua: 'wednesday', wednesday: 'wednesday',
  quinta: 'thursday', qui: 'thursday', thursday: 'thursday',
  sexta: 'friday', sex: 'friday', friday: 'friday',
  sabado: 'saturday', sábado: 'saturday', sab: 'saturday', saturday: 'saturday',
};
const WEEKDAY_PT: Record<string, string> = {
  sunday: 'domingo', monday: 'segunda-feira', tuesday: 'terça-feira',
  wednesday: 'quarta-feira', thursday: 'quinta-feira', friday: 'sexta-feira',
  saturday: 'sábado',
};

// ── Parsers ───────────────────────────────────────────────────────

function isSkip(text: string) {
  const t = text.toLowerCase().trim();
  return [
    'pular', 'pulo', 'skip', 'não', 'nao', 'proximo', 'próximo',
    'pass', '-', 'n', '.', 'nenhum', 'nenhuma',
  ].includes(t);
}

function parseTime(input: string): string | null {
  const clean = input.toLowerCase().trim().replace(/\s/g, '');
  const m = clean.match(/^(\d{1,2})(?:[h:](\d{2}))?/);
  if (!m || !m[1]) return null;
  const h = Number.parseInt(m[1]);
  const min = Number.parseInt(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function parseBirthDate(input: string): string | null {
  const t = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m1 = t.match(/^(\d{1,2})[/\-.~](\d{1,2})[/\-.~](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  return null;
}

function normWeekday(input: string): string | null {
  const key = input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  return WEEKDAY_MAP[key] ?? null;
}

// ── Types ─────────────────────────────────────────────────────────

type Message = { role: 'assistant' | 'user'; content: string };
type Payload = {
  name: string;
  birthDate: string;
  timezone: string;
  bio: string;
  goals: string;
  checkinMorning: string;
  checkinEvening: string;
  weeklyReviewDay: string;
};
type Status = 'resume' | 'questioning' | 'confirming' | 'saving';
type Step = {
  field: keyof Payload;
  question: (tz: string, p: Partial<Payload>) => string;
  optional: boolean;
  parse: (input: string, tz: string) => { value: string; valid: boolean };
  ack: (value: string, p: Partial<Payload>) => string;
  hint: string;
};

// ── Steps definition ─────────────────────────────────────────────

const STEPS: Step[] = [
  {
    field: 'name',
    question: () =>
      'Olá! Bem-vindo ao Hawk OS. 🦅\n\nSou o Hawk, seu assistente pessoal. Vou te ajudar a configurar o sistema em alguns passos simples.\n\nComo você gostaria de ser chamado?',
    optional: false,
    parse: (input) => {
      const v = input.trim().slice(0, 60);
      return { value: v, valid: v.length > 0 };
    },
    ack: (v) => `Prazer, **${v}**!`,
    hint: 'Por favor, informe como quer ser chamado.',
  },
  {
    field: 'birthDate',
    question: () =>
      'Qual é a sua data de nascimento? *(ex: 15/03/1990)*\n\n*Opcional — pode pular se preferir.*',
    optional: true,
    parse: (input) => {
      if (isSkip(input)) return { value: '', valid: true };
      const v = parseBirthDate(input);
      return v ? { value: v, valid: true } : { value: '', valid: false };
    },
    ack: (v) => (v ? 'Anotado!' : 'Sem problema!'),
    hint: 'Use o formato DD/MM/AAAA ou escreva **pular** para continuar.',
  },
  {
    field: 'timezone',
    question: (tz) =>
      `Seu fuso horário foi detectado como **${tz}**.\n\nEstá correto? Se não, informe o correto *(ex: Europe/Lisbon)*.`,
    optional: true,
    parse: (input, tz) => {
      const t = input.trim().toLowerCase();
      if (isSkip(input) || AFFIRM.has(t)) return { value: tz, valid: true };
      return { value: input.trim(), valid: input.trim().length > 0 };
    },
    ack: (v) => `Fuso horário: **${v}**.`,
    hint: 'Informe o fuso horário *(ex: America/Sao_Paulo)* ou escreva **sim** para confirmar o detectado.',
  },
  {
    field: 'bio',
    question: () =>
      'Me conte brevemente sobre você — quem você é, o que faz?\n\n*Opcional — pode pular.*',
    optional: true,
    parse: (input) => {
      if (isSkip(input)) return { value: '', valid: true };
      return { value: input.trim().slice(0, 300), valid: true };
    },
    ack: () => 'Obrigado por compartilhar!',
    hint: '',
  },
  {
    field: 'goals',
    question: () =>
      'O que você quer alcançar com o Hawk OS?\n\n*Opcional — pode pular.*',
    optional: true,
    parse: (input) => {
      if (isSkip(input)) return { value: '', valid: true };
      return { value: input.trim().slice(0, 500), valid: true };
    },
    ack: () => 'Ótimo!',
    hint: '',
  },
  {
    field: 'checkinMorning',
    question: () =>
      'Qual horário prefere para o **check-in da manhã**?\n\nPadrão: **09:00** — pode pular para usar o padrão.',
    optional: true,
    parse: (input) => {
      if (isSkip(input)) return { value: '09:00', valid: true };
      const v = parseTime(input);
      return v ? { value: v, valid: true } : { value: '', valid: false };
    },
    ack: (v) => `Check-in da manhã às **${v}**. ✓`,
    hint: 'Informe o horário no formato HH:MM *(ex: 08:30)* ou escreva **pular**.',
  },
  {
    field: 'checkinEvening',
    question: () =>
      'E para o **check-in da noite**?\n\nPadrão: **22:00**.',
    optional: true,
    parse: (input) => {
      if (isSkip(input)) return { value: '22:00', valid: true };
      const v = parseTime(input);
      return v ? { value: v, valid: true } : { value: '', valid: false };
    },
    ack: (v) => `Check-in da noite às **${v}**. ✓`,
    hint: 'Informe o horário no formato HH:MM *(ex: 21:00)* ou escreva **pular**.',
  },
  {
    field: 'weeklyReviewDay',
    question: () =>
      'Que dia da semana prefere para a **revisão semanal**?\n\nPadrão: **domingo**.',
    optional: true,
    parse: (input) => {
      if (isSkip(input)) return { value: 'sunday', valid: true };
      const v = normWeekday(input);
      return v ? { value: v, valid: true } : { value: '', valid: false };
    },
    ack: (v) => `Revisão semanal toda **${WEEKDAY_PT[v] ?? v}**. ✓`,
    hint: 'Informe um dia da semana em português *(ex: segunda, domingo)* ou escreva **pular**.',
  },
];

// ── Summary ───────────────────────────────────────────────────────

function buildSummary(p: Partial<Payload>, defaultTz: string): string {
  const lines: (string | null)[] = [
    `Aqui está o resumo da configuração para **${p.name ?? 'Você'}**:`,
    '',
    `- 👤 Nome: ${p.name ?? '—'}`,
    p.birthDate
      ? `- 🎂 Nascimento: ${p.birthDate}`
      : '- 🎂 Nascimento: *não informado*',
    `- 🌍 Fuso horário: ${p.timezone ?? defaultTz}`,
    p.bio ? `- 📝 Bio: ${p.bio}` : null,
    p.goals ? `- 🎯 Objetivos: ${p.goals}` : null,
    `- ☀️ Check-in manhã: ${p.checkinMorning ?? '09:00'}`,
    `- 🌙 Check-in noite: ${p.checkinEvening ?? '22:00'}`,
    `- 📊 Revisão semanal: ${WEEKDAY_PT[p.weeklyReviewDay ?? 'sunday']}`,
    '',
    'Tudo certo? Escreva **sim** para confirmar e começar!',
  ];
  return lines.filter(Boolean).join('\n');
}

// ── LocalStorage ──────────────────────────────────────────────────

type PersistedState = { stepIndex: number; payload: Partial<Payload>; messages: Message[] };

function loadSaved(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function clearSaved() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

// ── Bubble components ─────────────────────────────────────────────

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3 mb-6">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-bold text-white mt-0.5">
        HA
      </div>
      <div className="max-w-[620px] pt-1">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[480px] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] rounded-tr-[var(--radius-sm)] px-4 py-2.5">
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const tzRef = useRef('America/Sao_Paulo');

  const [status, setStatus] = useState<Status>('questioning');
  const [messages, setMessages] = useState<Message[]>([]);
  const [payload, setPayload] = useState<Partial<Payload>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set real timezone on client
  useEffect(() => {
    tzRef.current = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Persist progress
  useEffect(() => {
    if ((status === 'questioning' || status === 'confirming') && stepIndex > 0) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ stepIndex, payload, messages }));
      } catch {}
    }
  }, [messages, stepIndex, payload, status]);

  // Init — check for saved progress
  useEffect(() => {
    const saved = loadSaved();
    if (saved && saved.stepIndex > 0) {
      setMessages([
        ...saved.messages,
        {
          role: 'assistant',
          content:
            'Bem-vindo de volta! 👋 Parece que você começou a configuração anteriormente.\n\nQuer **continuar de onde parou** ou **recomeçar do zero**?',
        },
      ]);
      setPayload(saved.payload);
      setStepIndex(saved.stepIndex);
      setStatus('resume');
    } else {
      setMessages([{ role: 'assistant', content: STEPS[0].question(tzRef.current, {}) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save ────────────────────────────────────────────────────────

  const doSave = useCallback(
    async (pl: Partial<Payload>) => {
      setStatus('saving');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Tudo certo, **${pl.name}**! 🦅\n\nBem-vindo ao Hawk OS. Seu sistema está configurado e pronto para começar.`,
        },
      ]);
      await new Promise((r) => setTimeout(r, 1400));
      try {
        const res = await fetch('/api/setup/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: pl.name ?? 'Usuário',
            birthDate: pl.birthDate || undefined,
            timezone: pl.timezone ?? tzRef.current,
            bio: pl.bio || undefined,
            goals: pl.goals || undefined,
            checkinMorning: pl.checkinMorning ?? '09:00',
            checkinEvening: pl.checkinEvening ?? '22:00',
            weeklyReviewDay: pl.weeklyReviewDay ?? 'sunday',
            weeklyReviewTime: '20:00',
            enabledModules: ALL_MODULES,
            enabledAgents: ALL_AGENTS,
          }),
        });
        const result = (await res.json()) as { error?: string };
        if (!res.ok || result.error) {
          setError(result.error ?? 'Erro ao salvar. Tente novamente.');
          setStatus('confirming');
          return;
        }
        clearSaved();
        router.push('/dashboard');
      } catch {
        setError('Erro de conexão. Verifique sua internet e tente novamente.');
        setStatus('confirming');
      }
    },
    [router],
  );

  // ── Answer handler ──────────────────────────────────────────────

  const handleAnswer = useCallback(
    (text: string) => {
      if (status === 'saving' || status === 'resume') return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMsg: Message = { role: 'user', content: trimmed };
      setInputValue('');

      if (status === 'confirming') {
        const isConfirm =
          AFFIRM.has(trimmed.toLowerCase()) ||
          trimmed.toLowerCase().includes('sim') ||
          trimmed.toLowerCase().includes('confirmar');
        setMessages((prev) => {
          const updated = [...prev, userMsg];
          if (!isConfirm) {
            return [
              ...updated,
              {
                role: 'assistant',
                content: 'Pode confirmar escrevendo **sim** ou usando o botão abaixo.',
              },
            ];
          }
          return updated;
        });
        if (isConfirm) doSave(payload);
        return;
      }

      if (status !== 'questioning') return;
      const step = STEPS[stepIndex];
      if (!step) return;

      const { value, valid } = step.parse(trimmed, tzRef.current);

      if (!valid) {
        setMessages((prev) => [
          ...prev,
          userMsg,
          {
            role: 'assistant',
            content: step.hint || 'Não entendi. Tente novamente ou escreva **pular**.',
          },
        ]);
        return;
      }

      const newPayload = { ...payload, [step.field]: value };
      const nextIdx = stepIndex + 1;
      const isLast = nextIdx >= STEPS.length;
      const ackText = step.ack(value, newPayload);
      const followUp = isLast
        ? `${ackText}\n\n${buildSummary(newPayload, tzRef.current)}`
        : `${ackText}\n\n${STEPS[nextIdx].question(tzRef.current, newPayload)}`;

      setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: followUp }]);
      setPayload(newPayload);
      setStepIndex(nextIdx);
      if (isLast) setStatus('confirming');
    },
    [status, stepIndex, payload, doSave],
  );

  // ── Resume handlers ─────────────────────────────────────────────

  const handleContinue = useCallback(() => {
    setStatus('questioning');
    const step = STEPS[stepIndex];
    if (step) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: step.question(tzRef.current, payload) },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: buildSummary(payload, tzRef.current) },
      ]);
      setStatus('confirming');
    }
  }, [stepIndex, payload]);

  const handleRestart = useCallback(() => {
    clearSaved();
    setPayload({});
    setStepIndex(0);
    setMessages([{ role: 'assistant', content: STEPS[0].question(tzRef.current, {}) }]);
    setStatus('questioning');
  }, []);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-16 pb-4">
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <UserBubble key={i} content={msg.content} />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <AssistantBubble key={i} content={msg.content} />
            ),
          )}

          {/* Resume choice buttons */}
          {status === 'resume' && (
            <div className="flex gap-3 mb-6 pl-11">
              <button
                type="button"
                onClick={handleContinue}
                className="px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                Continuar de onde parei
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
              >
                Recomeçar do zero
              </button>
            </div>
          )}

          {/* Confirm button */}
          {status === 'confirming' && (
            <div className="flex justify-center mb-6">
              <button
                type="button"
                onClick={() => doSave(payload)}
                className="px-6 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                Confirmar e começar →
              </button>
            </div>
          )}

          {status === 'saving' && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-4 pl-11">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              Salvando configuração...
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-3 py-2">
              <p className="text-xs text-[var(--color-danger)]">{error}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {status !== 'resume' && status !== 'saving' && (
        <div className="flex-shrink-0 border-t border-[var(--color-border-subtle)]">
          <div className="max-w-2xl mx-auto">
            <ChatInput
              onSend={handleAnswer}
              loading={false}
              value={inputValue}
              onChange={setInputValue}
            />
          </div>
        </div>
      )}
    </div>
  );
}
