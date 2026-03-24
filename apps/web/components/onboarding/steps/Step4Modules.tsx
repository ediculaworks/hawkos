'use client';

import { Button } from '@/components/ui/button';
import { AGENTS, MODULES } from '@/lib/onboarding/types';
import { Check } from 'lucide-react';
import { useState } from 'react';

interface Step4ModulesProps {
  onNext: (data: { modules: string[]; agents: string[] }) => void;
  onBack: () => void;
  initialValues?: { modules?: string[]; agents?: string[] };
}

const ALL_MODULE_IDS = MODULES.map((m) => m.id);
const ALL_AGENT_IDS = AGENTS.map((a) => a.id);

export function Step4Modules({ onNext, onBack, initialValues }: Step4ModulesProps) {
  const [selectedModules, setSelectedModules] = useState<string[]>(
    initialValues?.modules ?? MODULES.filter((m) => m.category === 'core').map((m) => m.id),
  );
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    initialValues?.agents ?? ['bull', 'wolf'],
  );

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const allModulesSelected = ALL_MODULE_IDS.every((id) => selectedModules.includes(id));
  const allAgentsSelected = ALL_AGENT_IDS.every((id) => selectedAgents.includes(id));

  const toggleAllModules = () => {
    setSelectedModules(
      allModulesSelected
        ? MODULES.filter((m) => m.category === 'core').map((m) => m.id)
        : ALL_MODULE_IDS,
    );
  };

  const toggleAllAgents = () => {
    setSelectedAgents(allAgentsSelected ? ['bull', 'wolf'] : ALL_AGENT_IDS);
  };

  const coreModules = MODULES.filter((m) => m.category === 'core');
  const lifeModules = MODULES.filter((m) => m.category === 'life');
  const otherModules = MODULES.filter((m) => m.category === 'other');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Módulos e Agentes
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Escolha as funcionalidades que deseja ativar.
        </p>
      </div>

      {/* Agentes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">
            Agentes Specialists
          </h3>
          <button
            type="button"
            onClick={toggleAllAgents}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            {allAgentsSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {AGENTS.map((agent) => {
            const isSelected = selectedAgents.includes(agent.id);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {agent.name}
                  </span>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{agent.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Módulos — header com Select All */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">
          Módulos
        </h3>
        <button
          type="button"
          onClick={toggleAllModules}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          {allModulesSelected ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
      </div>

      {/* Módulos Core */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">
          Core (recomendados)
        </h3>
        <div className="space-y-2">
          {coreModules.map((module) => {
            const isSelected = selectedModules.includes(module.id);
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => toggleModule(module.id)}
                className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {module.name}
                  </span>
                  <p className="text-xs text-[var(--color-text-muted)]">{module.description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Módulos de Vida */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">Vida</h3>
        <div className="grid grid-cols-2 gap-2">
          {lifeModules.map((module) => {
            const isSelected = selectedModules.includes(module.id);
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => toggleModule(module.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {module.name}
                  </span>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{module.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Módulos Outros */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">Outros</h3>
        <div className="grid grid-cols-2 gap-2">
          {otherModules.map((module) => {
            const isSelected = selectedModules.includes(module.id);
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => toggleModule(module.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {module.name}
                  </span>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{module.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          Módulos e agentes podem ser habilitados/desabilitados depois em Configurações.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          ← Voltar
        </Button>
        <Button onClick={() => onNext({ modules: selectedModules, agents: selectedAgents })}>
          Próximo →
        </Button>
      </div>
    </div>
  );
}
