'use client';

import { ModelSelector } from '@/components/agents/model-selector';
import { type AgentSettings, ModelSettings } from '@/components/agents/model-settings';
import { ModuleSelector } from '@/components/agents/module-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Check, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useOfficeStore } from '../store/office-store';

interface AgentFormData {
  name: string;
  avatar: string;
  tagline: string;
  traits: string[];
  tone: string;
  phrases: string[];
  knowledge: string;
  philosophy: string;
  enabledTools: string[];
  llmModel: string;
  temperature: number;
  maxTokens: number;
  agentTier: string;
  identity: string;
  systemPrompt: string;
  memoryType: string;
}

const STEPS = [
  { id: 'identity', label: 'Identidade', description: 'Nome, avatar e tagline' },
  { id: 'personality', label: 'Personalidade', description: 'Traits, tom e frases' },
  { id: 'knowledge', label: 'Conhecimento', description: 'Base de conhecimento' },
  { id: 'philosophy', label: 'Filosofia', description: 'Valores e regras' },
  { id: 'tools', label: 'Ferramentas', description: 'Módulos habilitados' },
  { id: 'model', label: 'Modelo', description: 'Modelo de IA e configurações' },
];

const TEMPLATE_OPTIONS = [
  {
    id: 'hawk',
    name: 'Hawk (General)',
    description: 'Assistente geral, conhece todos os módulos.',
    icon: '🦅',
    defaults: {
      name: 'Hawk',
      avatar: 'hawk',
      tagline: 'Assistente pessoal inteligente',
      traits: ['Analítico', 'Prático', 'Organizado'],
      tone: 'Casual e prestativo',
      phrases: ['Vou verificar isso para você.', 'Encontrei uma oportunidade.'],
      knowledge: 'Hawk é o assistente pessoal do usuário.',
      philosophy: 'Respostas diretas e úteis. Use dados reais do contexto.',
      enabledTools: [
        'finances',
        'calendar',
        'routine',
        'journal',
        'objectives',
        'health',
        'people',
        'career',
        'knowledge',
        'assets',
        'housing',
        'legal',
        'entertainment',
        'social',
        'spirituality',
      ],
      llmModel: 'nvidia/nemotron-3-super-120b-a12b:free',
      temperature: 0.7,
      maxTokens: 4096,
      agentTier: 'orchestrator',
      memoryType: 'shared',
    },
  },
  {
    id: 'owl',
    name: 'Owl',
    description: 'Especialista em currículo e LinkedIn.',
    icon: '🦉',
    defaults: {
      name: 'Owl',
      avatar: 'mentor',
      tagline: 'Especialista em currículo e LinkedIn',
      traits: ['Estratégico', 'Organizado', 'Motivacional', 'Analítico'],
      tone: 'Prático e direto',
      phrases: ['Vamos otimizar seu perfil.'],
      knowledge: 'Especialista em ATS, LinkedIn, mercado brasileiro.',
      philosophy: 'ATS-first. Quantificar achievements.',
      enabledTools: ['career', 'finances', 'objectives', 'people', 'knowledge'],
      llmModel: 'openai/gpt-oss-120b:free',
      temperature: 0.7,
      maxTokens: 4096,
      agentTier: 'specialist',
      memoryType: 'shared',
    },
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Comece do zero.',
    icon: '✨',
    defaults: null,
  },
];

const TRAIT_OPTIONS = [
  'Analítico',
  'Criativo',
  'Empático',
  'Prático',
  'Estratégico',
  'Motivacional',
  'Calmo',
  'Energético',
  'Sarcástico',
  'Diplomático',
  'Curioso',
  'Organizado',
  'Paciente',
  'Assertivo',
];

const INITIAL_FORM: AgentFormData = {
  name: '',
  avatar: 'hawk',
  tagline: '',
  traits: [],
  tone: 'Casual e prestativo',
  phrases: [],
  knowledge: '',
  philosophy: '',
  enabledTools: [],
  llmModel: 'nvidia/nemotron-3-super-120b-a12b:free',
  temperature: 0.7,
  maxTokens: 4096,
  agentTier: 'specialist',
  identity: '',
  systemPrompt: '',
  memoryType: 'shared',
};

export function HiringWizard() {
  const isOpen = useOfficeStore((s) => s.hiringWizardOpen);
  const closeWizard = useOfficeStore((s) => s.closeHiringWizard);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<AgentFormData>({ ...INITIAL_FORM });
  const [newPhrase, setNewPhrase] = useState('');

  if (!isOpen) return null;

  const currentStep = STEPS[step];

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATE_OPTIONS.find((t) => t.id === templateId);
    if (!template?.defaults) {
      setSelectedTemplate('custom');
      return;
    }
    setSelectedTemplate(templateId);
    setFormData({ ...INITIAL_FORM, ...template.defaults });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        closeWizard();
        setStep(0);
        setFormData({ ...INITIAL_FORM });
        setSelectedTemplate(null);
        // Reload to show new agent
        window.location.reload();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const toggleTrait = (trait: string) => {
    setFormData((prev) => ({
      ...prev,
      traits: prev.traits.includes(trait)
        ? prev.traits.filter((t) => t !== trait)
        : [...prev.traits, trait],
    }));
  };

  const addPhrase = () => {
    if (newPhrase.trim()) {
      setFormData((prev) => ({ ...prev, phrases: [...prev.phrases, newPhrase.trim()] }));
      setNewPhrase('');
    }
  };

  const agentSettings: AgentSettings = {
    temperature: formData.temperature,
    maxTokens: formData.maxTokens,
    agentTier: formData.agentTier,
    memoryType: formData.memoryType,
    identity: formData.identity,
    systemPrompt: formData.systemPrompt,
  };

  const handleClose = () => {
    closeWizard();
    setStep(0);
    setFormData({ ...INITIAL_FORM });
    setSelectedTemplate(null);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Pixel-art header */}
        <div className="bg-[#1e1e2e] border-b-2 border-[#4a4a6a] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-mono font-bold text-white tracking-wider">NOVA VAGA</h2>
            <p className="text-xs text-[#888] font-mono">Contratar novo agente para a equipe</p>
          </div>
          <button type="button" onClick={handleClose} className="text-[#888] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 px-6 py-3 bg-[var(--color-surface-2)] overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  i === step
                    ? 'bg-[var(--color-accent)] text-white'
                    : i < step
                      ? 'bg-[var(--color-success)] text-white'
                      : 'bg-[var(--color-surface-1)] text-[var(--color-text-muted)]'
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px w-4 ${i < step ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            {currentStep?.label}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">{currentStep?.description}</p>

          {/* Step 0: Template selection */}
          {step === 0 && (
            <div className="space-y-3">
              {TEMPLATE_OPTIONS.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() =>
                    template.defaults ? applyTemplate(template.id) : setSelectedTemplate('custom')
                  }
                  className={`flex items-start gap-3 w-full p-3 rounded-lg border text-left transition-all ${
                    selectedTemplate === template.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)]'
                  }`}
                >
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--color-text-primary)]">
                        {template.name}
                      </span>
                      {template.defaults && (
                        <Badge variant="muted" className="text-[9px]">
                          <Star className="h-2.5 w-2.5 mr-0.5" /> Template
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">{template.description}</p>
                  </div>
                  {selectedTemplate === template.id && (
                    <Check className="h-4 w-4 text-[var(--color-accent)]" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Personality */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
                  Traits de Personalidade
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TRAIT_OPTIONS.map((trait) => (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => toggleTrait(trait)}
                      className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                        formData.traits.includes(trait)
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {trait}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor="tone"
                  className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block"
                >
                  Tom de Voz
                </label>
                <Input
                  id="tone"
                  value={formData.tone}
                  onChange={(e) => setFormData((p) => ({ ...p, tone: e.target.value }))}
                  placeholder="Ex: Formal, casual..."
                />
              </div>
              <div>
                <label
                  htmlFor="phrase"
                  className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block"
                >
                  Frases Características
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="phrase"
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPhrase()}
                    placeholder="Adicione uma frase..."
                  />
                  <Button size="icon" variant="ghost" onClick={addPhrase}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formData.phrases.map((phrase, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Removing items by index
                    <Badge key={`p-${i}`} variant="muted" className="gap-1 text-xs">
                      {phrase}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            phrases: p.phrases.filter((_, idx) => idx !== i),
                          }))
                        }
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Knowledge */}
          {step === 2 && (
            <textarea
              value={formData.knowledge}
              onChange={(e) => setFormData((p) => ({ ...p, knowledge: e.target.value }))}
              placeholder="Informações que o agente deve saber..."
              className="w-full h-48 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          )}

          {/* Step 3: Philosophy */}
          {step === 3 && (
            <textarea
              value={formData.philosophy}
              onChange={(e) => setFormData((p) => ({ ...p, philosophy: e.target.value }))}
              placeholder="Valores, crenças e regras..."
              className="w-full h-48 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          )}

          {/* Step 4: Tools */}
          {step === 4 && (
            <ModuleSelector
              selectedModules={formData.enabledTools}
              onToggleModule={(mod) =>
                setFormData((p) => ({
                  ...p,
                  enabledTools: p.enabledTools.includes(mod)
                    ? p.enabledTools.filter((m) => m !== mod)
                    : [...p.enabledTools, mod],
                }))
              }
            />
          )}

          {/* Step 5: Model */}
          {step === 5 && (
            <div>
              <ModelSelector
                selectedModel={formData.llmModel}
                onModelChange={(model) => setFormData((p) => ({ ...p, llmModel: model }))}
              />
              <ModelSettings
                settings={agentSettings}
                onSettingsChange={(s) =>
                  setFormData((p) => ({
                    ...p,
                    temperature: s.temperature,
                    maxTokens: s.maxTokens,
                    agentTier: s.agentTier,
                    memoryType: s.memoryType,
                    identity: s.identity,
                    systemPrompt: s.systemPrompt,
                  }))
                }
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (step > 0 ? setStep(step - 1) : handleClose())}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            {step === 0 ? 'Cancelar' : 'Anterior'}
          </Button>
          {step === STEPS.length - 1 ? (
            <Button size="sm" onClick={handleSave} disabled={saving || !formData.name}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? 'Contratando...' : 'Contratar Agente'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              Próximo
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
