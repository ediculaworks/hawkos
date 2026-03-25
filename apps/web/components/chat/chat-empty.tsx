'use client';

import type { Agent } from '@/lib/agent-chat';
import { MessageSquare } from 'lucide-react';

const STARTERS: Record<string, string[]> = {
  default: [
    'Como estão minhas finanças este mês?',
    'Quais são minhas tarefas para hoje?',
    'Resumo da minha semana',
    'Registra um gasto',
  ],
  Bull: [
    'Quanto gastei este mês por categoria?',
    'Como está meu orçamento?',
    'Análise do meu portfólio',
    'Obrigações fiscais pendentes',
  ],
  Wolf: [
    'Como dormi esta semana?',
    'Quais hábitos estou mantendo?',
    'Registrar treino de hoje',
    'Meu humor nos últimos 7 dias',
  ],
  Owl: [
    'Otimize meu currículo',
    'Sugestões para meu LinkedIn',
    'Como destacar minha experiência?',
    'Análise de vagas relevantes',
  ],
  Bee: [
    'O que tenho na agenda hoje?',
    'Priorize minhas tarefas',
    'Quem preciso contactar esta semana?',
    'Preparar contexto para reunião',
  ],
  Beaver: [
    'Contas vencendo esta semana',
    'Status da manutenção',
    'Checklist de segurança',
    'Credenciais salvas',
  ],
  Fox: [
    'Recomende um filme',
    'Status do meu backlog de jogos',
    'Ideias de post para LinkedIn',
    'O que li recentemente?',
  ],
  Peacock: [
    'Gere um avatar pixel art',
    'Crie uma thumbnail para post',
    'Ilustração minimalista',
    'Banner para perfil',
  ],
};

interface ChatEmptyProps {
  agent: Agent | null;
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  onSuggest: (text: string) => void;
}

export function ChatEmpty({ agent, agents, onSelectAgent, onSuggest }: ChatEmptyProps) {
  // No agent selected — show agent grid
  if (!agent) {
    const userFacing = agents.filter((a) => a.is_user_facing !== false);
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <MessageSquare className="h-10 w-10 text-[var(--color-text-muted)] mb-4 opacity-40" />
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          Escolha um agente
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Selecione um especialista para iniciar a conversa
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg">
          {userFacing.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelectAgent(a)}
              className="flex flex-col items-center gap-2 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-lg font-bold text-white">
                {a.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Agent selected — show starters
  const agentStarters = STARTERS[agent.name] ?? STARTERS.default ?? [];

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-20 h-20 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-3xl font-bold text-white mb-3">
        {agent.name.slice(0, 2).toUpperCase()}
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mt-3 mb-1">
        {agent.name}
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">{agent.tagline}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
        {agentStarters.map((starter) => (
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
