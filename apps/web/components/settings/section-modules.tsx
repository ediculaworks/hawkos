'use client';

import { Switch } from '@/components/ui/switch';
import type { ModuleRow } from '@/lib/actions/settings';
import { updateModuleEnabled } from '@/lib/actions/settings';
import { getModuleConfig } from '@/lib/modules';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

const MODULE_DESCRIPTIONS: Record<string, string> = {
  finances: 'Contas, transações, orçamento e portfólio',
  calendar: 'Eventos, lembretes e agenda do Google Calendar',
  routine: 'Hábitos diários, streaks e rotinas',
  health: 'Treinos, sono, peso e observações de saúde',
  objectives: 'Metas, tarefas e OKRs',
  career: 'Trabalho, projetos e desenvolvimento profissional',
  assets: 'Patrimônio, documentos e bens',
  legal: 'Contratos, obrigações legais e entidades',
  housing: 'Contas de moradia, manutenção e inquilinos',
  entertainment: 'Mídia, hobbies e lazer',
  people: 'Contatos, interações e networking',
  social: 'Redes sociais, conteúdo e presença online',
  knowledge: 'Notas, aprendizados e segundo cérebro',
  journal: 'Diário pessoal e reflexões',
  spirituality: 'Práticas espirituais e meditação',
  security: 'Senhas, 2FA e segurança digital',
};

interface SectionModulesProps {
  modules: ModuleRow[];
  onToggle: (id: string, enabled: boolean) => void;
}

export function SectionModules({ modules, onToggle }: SectionModulesProps) {
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (moduleId: string, enabled: boolean) => {
    setToggling(moduleId);
    const result = await updateModuleEnabled(moduleId, enabled);
    if (result.success) {
      onToggle(moduleId, enabled);
    }
    setToggling(null);
  };

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Módulos</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Ative ou desative módulos do sistema. Módulos desativados não aparecem na sidebar.
        </p>
      </div>

      <div className="space-y-[var(--space-2)] max-w-lg">
        {modules.map((mod) => {
          const config = getModuleConfig(mod.id);
          if (!config) return null;
          const Icon = config.icon;
          const isToggling = toggling === mod.id;

          return (
            <div
              key={mod.id}
              className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <div className="flex items-center gap-[var(--space-3)]">
                <div
                  className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${config.colorVar}, transparent 85%)`,
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: config.colorVar }} />
                </div>
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {config.label}
                  </span>
                  {MODULE_DESCRIPTIONS[mod.id] && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {MODULE_DESCRIPTIONS[mod.id]}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-[var(--space-2)]">
                {isToggling && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-text-muted)]" />
                )}
                <Switch
                  checked={mod.enabled}
                  onCheckedChange={(checked) => handleToggle(mod.id, checked)}
                  disabled={isToggling}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
