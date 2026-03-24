'use client';

import { ModelSelector } from '@/components/agents/model-selector';
import { type AgentSettings, ModelSettings } from '@/components/agents/model-settings';
import { ModuleSelector } from '@/components/agents/module-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AgentFormData {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  traits: string[];
  tone: string;
  phrases: string[];
  knowledge: string;
  philosophy: string;
  enabledTools: string[];
  is_system: boolean;
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

const AVATAR_OPTIONS = [
  'hawk',
  'robot',
  'wizard',
  'ninja',
  'astronaut',
  'detective',
  'mentor',
  'assistant',
  'explorer',
  'sage',
  'guardian',
  'artist',
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

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<AgentFormData>({
    id: '',
    name: '',
    avatar: 'robot',
    tagline: '',
    traits: [],
    tone: 'Casual e prestativo',
    phrases: [],
    knowledge: '',
    philosophy: '',
    enabledTools: [],
    is_system: false,
    llmModel: 'nvidia/nemotron-3-super-120b-a12b:free',
    temperature: 0.7,
    maxTokens: 4096,
    agentTier: 'specialist',
    identity: '',
    systemPrompt: '',
    memoryType: 'shared',
  });
  const [newPhrase, setNewPhrase] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: Load agent on mount
  useEffect(() => {
    loadAgent();
  }, [agentId]);

  const loadAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        const a = data.agent;
        setFormData({
          id: a.id,
          name: a.name,
          avatar: a.avatar,
          tagline: a.tagline,
          traits: a.traits || [],
          tone: a.tone || '',
          phrases: a.phrases || [],
          knowledge: a.knowledge || '',
          philosophy: a.philosophy || '',
          enabledTools: a.enabled_tools || [],
          is_system: a.is_system || false,
          llmModel: a.llm_model || 'nvidia/nemotron-3-super-120b-a12b:free',
          temperature: a.temperature ?? 0.7,
          maxTokens: a.max_tokens ?? 4096,
          agentTier: a.agent_tier || 'specialist',
          identity: a.identity || '',
          systemPrompt: a.system_prompt || '',
          memoryType: a.memory_type || 'shared',
        });
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Client-side error logging
      console.error('Failed to load agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
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
      setFormData((prev) => ({
        ...prev,
        phrases: [...prev.phrases, newPhrase.trim()],
      }));
      setNewPhrase('');
    }
  };

  const removePhrase = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      phrases: prev.phrases.filter((_, i) => i !== index),
    }));
  };

  const toggleModule = (moduleId: string) => {
    setFormData((prev) => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(moduleId)
        ? prev.enabledTools.filter((m) => m !== moduleId)
        : [...prev.enabledTools, moduleId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push('/dashboard/agents');
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Client-side error logging
      console.error('Failed to save agent:', error);
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[step] ?? STEPS[0];

  const agentSettings: AgentSettings = {
    temperature: formData.temperature,
    maxTokens: formData.maxTokens,
    agentTier: formData.agentTier,
    memoryType: formData.memoryType,
    identity: formData.identity,
    systemPrompt: formData.systemPrompt,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-[var(--space-4)] mb-[var(--space-6)]">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/agents')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Editar Agente</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Configure o agente {formData.name}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-6)] overflow-x-auto pb-[var(--space-2)]">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-[var(--space-2)]">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] text-sm transition-colors ${
                i === step
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : i < step
                    ? 'bg-[var(--color-success)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 ${i < step ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{currentStep?.label ?? ''}</CardTitle>
          <p className="text-sm text-[var(--color-text-muted)]">{currentStep?.description ?? ''}</p>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-[var(--space-4)]">
              <div>
                <label
                  htmlFor="agent-name"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
                >
                  Nome do Agente
                </label>
                <Input
                  id="agent-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Hawk, Assistente, Conselheiro..."
                />
              </div>
              <div>
                <label
                  htmlFor="agent-tagline"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
                >
                  Tagline
                </label>
                <Input
                  id="agent-tagline"
                  value={formData.tagline}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Uma frase que define o agente..."
                />
              </div>
              <div>
                <span className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block">
                  Avatar
                </span>
                <div className="grid grid-cols-4 gap-[var(--space-3)]">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, avatar }))}
                      className={`aspect-square rounded-[var(--radius-lg)] flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 ${
                        formData.avatar === avatar
                          ? 'bg-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-offset-2'
                          : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-1)]'
                      }`}
                    >
                      <span className="text-4xl">{getAvatarEmoji(avatar)}</span>
                      <span
                        className={`text-xs capitalize ${formData.avatar === avatar ? 'text-white' : 'text-[var(--color-text-muted)]'}`}
                      >
                        {avatar}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-[var(--space-4)]">
              <div>
                <span className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block">
                  Traits de Personalidade
                </span>
                <div className="flex flex-wrap gap-[var(--space-2)] mb-[var(--space-2)]">
                  {TRAIT_OPTIONS.map((trait) => (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => toggleTrait(trait)}
                      className={`px-[var(--space-3)] py-[var(--space-1)] rounded-full text-sm transition-colors ${
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
                  htmlFor="agent-tone"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
                >
                  Tom de Voz
                </label>
                <Input
                  id="agent-tone"
                  value={formData.tone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tone: e.target.value }))}
                  placeholder="Ex: Formal, casual, motivacional..."
                />
              </div>
              <div>
                <label
                  htmlFor="agent-phrase"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
                >
                  Frases Características
                </label>
                <div className="flex gap-[var(--space-2)] mb-[var(--space-2)]">
                  <Input
                    id="agent-phrase"
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPhrase()}
                    placeholder="Adicione uma frase..."
                  />
                  <Button size="icon" variant="ghost" onClick={addPhrase}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {formData.phrases.map((phrase, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Removing items by index requires index key
                    <Badge key={`phrase-${i}`} variant="muted" className="gap-[var(--space-1)]">
                      {phrase}
                      <button type="button" onClick={() => removePhrase(i)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-[var(--space-4)]">
              <div>
                <label
                  htmlFor="agent-knowledge"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
                >
                  Base de Conhecimento
                </label>
                <textarea
                  id="agent-knowledge"
                  value={formData.knowledge}
                  onChange={(e) => setFormData((prev) => ({ ...prev, knowledge: e.target.value }))}
                  placeholder="Informações que o agente deve saber..."
                  className="w-full h-64 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-1)]">
                  Este conhecimento será usado como base para todas as conversas do agente.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-[var(--space-4)]">
              <div>
                <label
                  htmlFor="agent-philosophy"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
                >
                  Filosofia e Valores
                </label>
                <textarea
                  id="agent-philosophy"
                  value={formData.philosophy}
                  onChange={(e) => setFormData((prev) => ({ ...prev, philosophy: e.target.value }))}
                  placeholder="Valores, crenças e regras do agente..."
                  className="w-full h-64 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-[var(--space-4)]">
              <div>
                <span className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block">
                  Módulos Habilitados
                </span>
                <ModuleSelector
                  selectedModules={formData.enabledTools}
                  onToggleModule={toggleModule}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <ModelSelector
                selectedModel={formData.llmModel}
                onModelChange={(model) => setFormData((prev) => ({ ...prev, llmModel: model }))}
              />
              <ModelSettings
                settings={agentSettings}
                onSettingsChange={(s) =>
                  setFormData((prev) => ({
                    ...prev,
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
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-[var(--space-4)]">
        <Button variant="outline" onClick={handleBack} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-[var(--space-2)]" />
          Anterior
        </Button>
        {step === STEPS.length - 1 ? (
          <Button onClick={handleSave} disabled={saving || !formData.name}>
            <Save className="h-4 w-4 mr-[var(--space-2)]" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Próximo
            <ArrowRight className="h-4 w-4 ml-[var(--space-2)]" />
          </Button>
        )}
      </div>
    </div>
  );
}

function getAvatarEmoji(avatar: string): string {
  const emojis: Record<string, string> = {
    hawk: '🦅',
    robot: '🤖',
    wizard: '🧙',
    ninja: '🥷',
    astronaut: '🧑‍🚀',
    detective: '🕵️',
    mentor: '🧑‍🏫',
    assistant: '🤝',
    explorer: '🧭',
    sage: '🧘',
    guardian: '🛡️',
    artist: '🎨',
  };
  return emojis[avatar] || '🤖';
}
