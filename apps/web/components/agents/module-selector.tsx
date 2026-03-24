'use client';

export const MODULE_OPTIONS = [
  { id: 'finances', label: 'Finanças', description: 'Contas, transações, saldo' },
  { id: 'calendar', label: 'Agenda', description: 'Eventos, lembretes' },
  { id: 'routine', label: 'Hábitos', description: 'Rotinas, trackers' },
  { id: 'journal', label: 'Diário', description: 'Reflexões, humor' },
  { id: 'objectives', label: 'Metas', description: 'Objetivos, tarefas' },
  { id: 'health', label: 'Saúde', description: 'Sono, treino, remédios' },
  { id: 'people', label: 'Pessoas', description: 'Contatos, interações' },
  { id: 'career', label: 'Carreira', description: 'Projetos, horas' },
  { id: 'knowledge', label: 'Conhecimento', description: 'Notas, livros' },
  { id: 'assets', label: 'Patrimônio', description: 'Bens, documentos' },
  { id: 'housing', label: 'Moradia', description: 'Casa, contas, manutenção' },
  { id: 'legal', label: 'Jurídico', description: 'Obligações, contratos' },
  { id: 'entertainment', label: 'Entretenimento', description: 'Filmes, hobbies' },
  { id: 'social', label: 'Social', description: 'Posts, metas sociais' },
  { id: 'spirituality', label: 'Espiritualidade', description: 'Reflexões, valores' },
];

interface ModuleSelectorProps {
  selectedModules: string[];
  onToggleModule: (moduleId: string) => void;
}

export function ModuleSelector({ selectedModules, onToggleModule }: ModuleSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-[var(--space-2)]">
      {MODULE_OPTIONS.map((mod) => (
        <button
          key={mod.id}
          type="button"
          onClick={() => onToggleModule(mod.id)}
          className={`p-[var(--space-3)] rounded-[var(--radius-md)] text-left transition-colors ${
            selectedModules.includes(mod.id)
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)]'
          }`}
        >
          <div className="font-medium text-sm">{mod.label}</div>
          <div
            className={`text-xs ${selectedModules.includes(mod.id) ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}
          >
            {mod.description}
          </div>
        </button>
      ))}
    </div>
  );
}
