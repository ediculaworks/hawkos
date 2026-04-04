'use client';

const STARTERS = [
  'Como estão minhas finanças este mês?',
  'Quais são minhas tarefas para hoje?',
  'Resumo da minha semana',
  'Registra um gasto',
];

interface ChatEmptyProps {
  onSuggest: (text: string) => void;
}

export function ChatEmpty({ onSuggest }: ChatEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-20 h-20 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-5xl leading-none mb-3">
        🦅
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mt-3 mb-1">Hawk</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Seu agente pessoal. Como posso ajudar?
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onSuggest(starter)}
            className="text-left px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-all cursor-pointer"
          >
            <span className="text-sm text-[var(--color-text-secondary)]">{starter}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
