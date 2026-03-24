'use client';

import { ModelSelector } from '@/components/agents/model-selector';
import { type AgentSettings, ModelSettings } from '@/components/agents/model-settings';
import { ModuleSelector } from '@/components/agents/module-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Check, Plus, Save, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    description: 'Assistente geral, conhece todos os módulos e o contexto completo do usuário.',
    icon: '🦅',
    default: {
      name: 'Hawk',
      avatar: 'hawk',
      tagline: 'Assistente pessoal inteligente',
      traits: ['Analítico', 'Prático', 'Organizado'],
      tone: 'Casual e prestativo',
      phrases: ['Vou verificar isso para você.', 'Encontrei uma oportunidade.'],
      knowledge:
        'Hawk é o assistente pessoal do usuário. Conhece todos os módulos do sistema e o contexto carregado dinamicamente do perfil e memórias.',
      philosophy:
        'Respostas diretas e úteis. Use dados reais do contexto. Não invente informações. Confirme operações importantes.',
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
    description: 'Especialista em currículo, LinkedIn e oportunidades de carreira.',
    icon: '🦉',
    default: {
      name: 'Owl',
      avatar: 'mentor',
      tagline: 'Especialista em currículo e LinkedIn',
      traits: ['Estratégico', 'Organizado', 'Motivacional', 'Analítico'],
      tone: 'Prático e direto',
      phrases: ['Vamos otimizar seu perfil.', 'O LinkedIn é sua vitrine profissional.'],
      knowledge:
        'Especialista em ATS (Applicant Tracking Systems), otimização de LinkedIn para recruiters, e mercado brasileiro de trabalho (CLT, PJ, freelance). Usa o contexto do perfil do usuário carregado dinamicamente.',
      philosophy:
        'ATS-first: todo currículo formatado para passar em sistemas de triagem. Quantificar achievements > descrições genéricas. Keywords são rei. Proativo: sugira melhorias quando identificar oportunidades.',
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
    description: 'Comece do zero e configure cada detalhe do seu jeito.',
    icon: '✨',
    default: null,
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

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<AgentFormData>({
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
  });
  const [newPhrase, setNewPhrase] = useState('');

  const currentStep = STEPS[step] ?? STEPS[0];

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATE_OPTIONS.find((t) => t.id === templateId);
    if (!template || !template.default) {
      setSelectedTemplate('custom');
      return;
    }
    setSelectedTemplate(templateId);
    setFormData({
      name: template.default.name,
      avatar: template.default.avatar,
      tagline: template.default.tagline,
      traits: template.default.traits,
      tone: template.default.tone,
      phrases: template.default.phrases,
      knowledge: template.default.knowledge,
      philosophy: template.default.philosophy,
      enabledTools: template.default.enabledTools,
      llmModel: template.default.llmModel,
      temperature: template.default.temperature,
      maxTokens: template.default.maxTokens,
      agentTier: template.default.agentTier,
      identity: '',
      systemPrompt: '',
      memoryType: template.default.memoryType,
    });
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
      const res = await fetch('/api/agents', {
        method: 'POST',
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

  const agentSettings: AgentSettings = {
    temperature: formData.temperature,
    maxTokens: formData.maxTokens,
    agentTier: formData.agentTier,
    memoryType: formData.memoryType,
    identity: formData.identity,
    systemPrompt: formData.systemPrompt,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-[var(--space-4)] mb-[var(--space-6)]">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/agents')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Criar Agente</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Configure um novo agente de IA</p>
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
                <p className="text-sm text-[var(--color-text-muted)] mb-[var(--space-4)]">
                  Escolha um modelo pré-configurado ou comece do zero.
                </p>
                <div className="grid gap-[var(--space-3)]">
                  {TEMPLATE_OPTIONS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        if (template.id === 'custom') {
                          setSelectedTemplate('custom');
                        } else {
                          applyTemplate(template.id);
                        }
                      }}
                      className={`flex items-start gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-lg)] border text-left transition-all hover:scale-[1.01] ${
                        selectedTemplate === template.id
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-1)]'
                      }`}
                    >
                      <span className="text-3xl flex-shrink-0">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-[var(--space-2)]">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {template.name}
                          </span>
                          {template.default && (
                            <Badge variant="muted" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Template
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
                          {template.description}
                        </p>
                      </div>
                      {selectedTemplate === template.id && (
                        <Check className="h-5 w-5 text-[var(--color-accent)] flex-shrink-0 mt-[var(--space-1)]" />
                      )}
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
                    // biome-ignore lint/suspicious/noArrayIndexKey: Removing items by index
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
            {saving ? 'Salvando...' : 'Criar Agente'}
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
