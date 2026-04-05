'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { agentHeaders, getAgentApiUrl } from '@/lib/config';
import { Bot, Loader2, Save, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

const TIMEZONES = [
  { id: 'America/Sao_Paulo', label: 'Sao Paulo (GMT-3)' },
  { id: 'America/New_York', label: 'New York (GMT-5)' },
  { id: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { id: 'Europe/London', label: 'London (GMT+0)' },
  { id: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { id: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
];

const LANGUAGES = [
  { id: 'pt-BR', label: 'Portugues (Brasil)' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'es-ES', label: 'Espanol' },
];

interface AgentSettings {
  agent_name: string;
  tenant_name: string;
  llm_model: string;
  temperature: number;
  max_tokens: number;
  heartbeat_interval: number;
  offline_threshold: number;
  auto_restart: boolean;
  enabled_channels: string[];
  timezone: string;
  language: string;
  big_purchase_threshold: number;
  react_mode: 'auto' | 'always' | 'never';
  cost_tracking_enabled: boolean;
  history_compression_enabled: boolean;
}

const DEFAULTS: AgentSettings = {
  agent_name: 'Hawk',
  tenant_name: 'My Agent',
  llm_model: 'qwen/qwen3.6-plus:free',
  temperature: 0.7,
  max_tokens: 2048,
  heartbeat_interval: 30,
  offline_threshold: 60,
  auto_restart: true,
  enabled_channels: ['discord', 'web'],
  timezone: 'America/Sao_Paulo',
  language: 'pt-BR',
  big_purchase_threshold: 0,
  react_mode: 'auto',
  cost_tracking_enabled: true,
  history_compression_enabled: true,
};

// Heartbeat config
const HB_MIN = 10;
const HB_MAX = 120;
const HB_STEP = 5;

function estimateTokensPerDay(heartbeatSeconds: number): { tokens: number; cost: string } {
  const beatsPerDay = (24 * 60 * 60) / heartbeatSeconds;
  // ~50 tokens per heartbeat (ping + response)
  const tokensPerBeat = 50;
  const total = Math.round(beatsPerDay * tokensPerBeat);
  // Free models = $0, but show estimated for paid
  const costUsd = total * 0.000001; // ~$1/M tokens average
  return {
    tokens: total,
    cost: costUsd < 0.01 ? 'Free (modelos gratuitos)' : `~$${costUsd.toFixed(2)}/dia`,
  };
}

export function SectionAgent() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [initial, setInitial] = useState<AgentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getAgentApiUrl()}/settings`, { headers: agentHeaders() });
        if (!res.ok) throw new Error('offline');
        const data = await res.json();
        const s: AgentSettings = {
          agent_name: data.settings?.agent_name ?? DEFAULTS.agent_name,
          tenant_name: data.settings?.tenant_name ?? DEFAULTS.tenant_name,
          llm_model: data.settings?.llm_model ?? DEFAULTS.llm_model,
          temperature: data.settings?.temperature ?? DEFAULTS.temperature,
          max_tokens: data.settings?.max_tokens ?? DEFAULTS.max_tokens,
          heartbeat_interval: data.settings?.heartbeat_interval ?? DEFAULTS.heartbeat_interval,
          offline_threshold: data.settings?.offline_threshold ?? DEFAULTS.offline_threshold,
          auto_restart: data.settings?.auto_restart ?? DEFAULTS.auto_restart,
          enabled_channels: data.settings?.enabled_channels ?? DEFAULTS.enabled_channels,
          timezone: data.settings?.timezone ?? DEFAULTS.timezone,
          language: data.settings?.language ?? DEFAULTS.language,
          big_purchase_threshold:
            data.settings?.big_purchase_threshold ?? DEFAULTS.big_purchase_threshold,
          react_mode: data.settings?.react_mode ?? DEFAULTS.react_mode,
          cost_tracking_enabled:
            data.settings?.cost_tracking_enabled ?? DEFAULTS.cost_tracking_enabled,
          history_compression_enabled:
            data.settings?.history_compression_enabled ?? DEFAULTS.history_compression_enabled,
        };
        setSettings(s);
        setInitial(s);
      } catch {
        setSettings({ ...DEFAULTS });
        setInitial({ ...DEFAULTS });
        setOffline(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = settings && initial && JSON.stringify(settings) !== JSON.stringify(initial);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch(`${getAgentApiUrl()}/settings`, {
        method: 'PUT',
        headers: agentHeaders(),
        body: JSON.stringify(settings),
      });
      setInitial({ ...settings });
      setSaved(true);
      setOffline(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setOffline(true);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<AgentSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (!settings) return null;

  const selectClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 transition-colors';

  const hbEstimate = estimateTokensPerDay(settings.heartbeat_interval);
  const hbPercent = ((settings.heartbeat_interval - HB_MIN) / (HB_MAX - HB_MIN)) * 100;

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
          <Bot className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Agente</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Configuracoes do agente AI.
        </p>
        {offline && (
          <p className="text-xs text-[var(--color-warning)] mt-[var(--space-2)]">
            Agente offline. Mostrando valores padrao.
          </p>
        )}
      </div>

      <div className="space-y-[var(--space-5)] max-w-lg">
        {/* Identity */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-[var(--space-4)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Identidade</h3>
          <div className="grid grid-cols-2 gap-[var(--space-4)]">
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="agent_name">Nome do Agente</Label>
              <Input
                id="agent_name"
                value={settings.agent_name}
                onChange={(e) => update({ agent_name: e.target.value })}
                placeholder="Hawk"
              />
            </div>
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="tenant_name">Workspace</Label>
              <Input
                id="tenant_name"
                value={settings.tenant_name}
                onChange={(e) => update({ tenant_name: e.target.value })}
                placeholder="My Agent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-4)]">
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="agent_tz">Fuso Horario</Label>
              <select
                id="agent_tz"
                value={settings.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                className={selectClass}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="agent_lang">Idioma</Label>
              <select
                id="agent_lang"
                value={settings.language}
                onChange={(e) => update({ language: e.target.value })}
                className={selectClass}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Smart Routing */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-[var(--space-4)]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Smart Routing ativo
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            O modelo e selecionado automaticamente por complexidade usando modelos free do
            OpenRouter. Configure via variaveis de ambiente no servidor.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { tier: 'Simples', model: 'nemotron-nano', color: 'var(--color-success)' },
              { tier: 'Padrao', model: 'qwen3.6-plus', color: 'var(--color-accent)' },
              { tier: 'Complexo', model: 'qwen3.6-plus', color: 'var(--color-warning)' },
            ].map((t) => (
              <div
                key={t.tier}
                className="p-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)] text-center"
              >
                <div className="text-[10px] font-medium" style={{ color: t.color }}>
                  {t.tier}
                </div>
                <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
                  {t.model}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Limites
          </h3>
          <div className="grid gap-[var(--space-2)]">
            <Label htmlFor="purchase_threshold">Limite para confirmar gastos (R$)</Label>
            <Input
              id="purchase_threshold"
              type="number"
              value={settings.big_purchase_threshold}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                if (!Number.isNaN(val)) update({ big_purchase_threshold: val });
              }}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              O agente confirmara gastos acima deste valor. 0 = sem limite.
            </p>
          </div>
        </div>

        {/* Heartbeat slider */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Heartbeat
          </h3>
          <div className="space-y-[var(--space-3)]">
            <div className="flex items-center justify-between">
              <Label>Intervalo</Label>
              <span className="text-sm font-mono text-[var(--color-accent)]">
                {settings.heartbeat_interval}s
              </span>
            </div>

            {/* Slider */}
            <div className="relative">
              <div className="h-2 rounded-full bg-[var(--color-surface-3)]">
                <div
                  className="h-2 rounded-full bg-[var(--color-accent)] transition-all duration-150"
                  style={{ width: `${hbPercent}%` }}
                />
              </div>
              <input
                type="range"
                min={HB_MIN}
                max={HB_MAX}
                step={HB_STEP}
                value={settings.heartbeat_interval}
                onChange={(e) => update({ heartbeat_interval: Number(e.target.value) })}
                className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
              />
            </div>

            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
              <span>{HB_MIN}s</span>
              <span>{HB_MAX}s</span>
            </div>

            {/* Token estimator */}
            <div className="grid grid-cols-2 gap-[var(--space-3)] p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)]">
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                  Tokens/dia estimados
                </div>
                <div className="text-sm font-mono text-[var(--color-text-primary)]">
                  {hbEstimate.tokens.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                  Custo estimado
                </div>
                <div className="text-sm font-mono text-[var(--color-text-primary)]">
                  {hbEstimate.cost}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-[var(--space-2)]">
              <div className="grid gap-[var(--space-1)]">
                <Label>Auto-restart</Label>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Reiniciar automaticamente se offline
                </p>
              </div>
              <Switch
                checked={settings.auto_restart}
                onCheckedChange={(checked) => update({ auto_restart: checked })}
              />
            </div>
          </div>
        </div>

        {/* Behaviour */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Comportamento
          </h3>
          <div className="space-y-[var(--space-4)]">
            <div className="grid gap-[var(--space-2)]">
              <Label htmlFor="react_mode">Modo ReAct</Label>
              <select
                id="react_mode"
                value={settings.react_mode}
                onChange={(e) =>
                  update({ react_mode: e.target.value as 'auto' | 'always' | 'never' })
                }
                className={selectClass}
              >
                <option value="auto">Auto - decide automaticamente</option>
                <option value="always">Sempre ativo</option>
                <option value="never">Nunca</option>
              </select>
              <p className="text-xs text-[var(--color-text-muted)]">
                Controla quando o agente usa raciocinio passo a passo
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="grid gap-[var(--space-1)]">
                <Label>Rastreamento de Custos</Label>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Registra o custo estimado de cada chamada ao LLM
                </p>
              </div>
              <Switch
                checked={settings.cost_tracking_enabled}
                onCheckedChange={(checked) => update({ cost_tracking_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="grid gap-[var(--space-1)]">
                <Label>Compressao de Historico</Label>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Comprime sessoes antigas para reduzir tokens no contexto
                </p>
              </div>
              <Switch
                checked={settings.history_compression_enabled}
                onCheckedChange={(checked) => update({ history_compression_enabled: checked })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-[var(--space-4)]">
        <Button onClick={handleSave} disabled={saving || !isDirty || offline}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
