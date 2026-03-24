'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { agentHeaders, getAgentApiUrl } from '@/lib/config';
import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

const POPULAR_MODELS = [
  { id: 'openrouter/auto', label: 'Auto (OpenRouter)' },
  { id: 'openrouter/free', label: 'Free (OpenRouter)' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'google/gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
  { id: 'openai/gpt-4.3', label: 'GPT-4.3' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B (Free)' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
];

const TIMEZONES = [
  { id: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { id: 'America/New_York', label: 'New York (GMT-5)' },
  { id: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { id: 'Europe/London', label: 'London (GMT+0)' },
  { id: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { id: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
];

const LANGUAGES = [
  { id: 'pt-BR', label: 'Português (Brasil)' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'es-ES', label: 'Español' },
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
  checkin_morning_enabled: boolean;
  checkin_morning_time: string;
  checkin_evening_enabled: boolean;
  checkin_evening_time: string;
  weekly_review_enabled: boolean;
  weekly_review_time: string;
  alerts_enabled: boolean;
  alerts_time: string;
  big_purchase_threshold: number;
}

const DEFAULTS: AgentSettings = {
  agent_name: 'Hawk',
  tenant_name: 'My Agent',
  llm_model: 'openrouter/auto',
  temperature: 0.7,
  max_tokens: 2048,
  heartbeat_interval: 30,
  offline_threshold: 60,
  auto_restart: true,
  enabled_channels: ['discord', 'web'],
  timezone: 'America/Sao_Paulo',
  language: 'pt-BR',
  checkin_morning_enabled: true,
  checkin_morning_time: '09:00',
  checkin_evening_enabled: true,
  checkin_evening_time: '22:00',
  weekly_review_enabled: true,
  weekly_review_time: '20:00',
  alerts_enabled: true,
  alerts_time: '08:00',
  big_purchase_threshold: 500,
};

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
          checkin_morning_enabled:
            data.settings?.checkin_morning_enabled ?? DEFAULTS.checkin_morning_enabled,
          checkin_morning_time:
            data.settings?.checkin_morning_time ?? DEFAULTS.checkin_morning_time,
          checkin_evening_enabled:
            data.settings?.checkin_evening_enabled ?? DEFAULTS.checkin_evening_enabled,
          checkin_evening_time:
            data.settings?.checkin_evening_time ?? DEFAULTS.checkin_evening_time,
          weekly_review_enabled:
            data.settings?.weekly_review_enabled ?? DEFAULTS.weekly_review_enabled,
          weekly_review_time: data.settings?.weekly_review_time ?? DEFAULTS.weekly_review_time,
          alerts_enabled: data.settings?.alerts_enabled ?? DEFAULTS.alerts_enabled,
          alerts_time: data.settings?.alerts_time ?? DEFAULTS.alerts_time,
          big_purchase_threshold:
            data.settings?.big_purchase_threshold ?? DEFAULTS.big_purchase_threshold,
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

  const toggleChannel = (channel: string, enabled: boolean) => {
    if (!settings) return;
    const channels = enabled
      ? [...settings.enabled_channels, channel]
      : settings.enabled_channels.filter((c) => c !== channel);
    update({ enabled_channels: channels });
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
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]';

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Agente</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Configurações do agente e automações.
        </p>
        {offline && (
          <p className="text-xs text-[var(--color-warning)] mt-[var(--space-2)]">
            Agente offline. Mostrando valores padrão.
          </p>
        )}
      </div>

      {/* Identity */}
      <div className="space-y-[var(--space-5)] max-w-lg">
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
            <Label htmlFor="tenant_name">Nome do Workspace</Label>
            <Input
              id="tenant_name"
              value={settings.tenant_name}
              onChange={(e) => update({ tenant_name: e.target.value })}
              placeholder="My Agent"
            />
          </div>
        </div>

        {/* Language & Timezone */}
        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div className="grid gap-[var(--space-2)]">
            <Label htmlFor="timezone">Fuso Horário</Label>
            <select
              id="timezone"
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
            <Label htmlFor="language">Idioma</Label>
            <select
              id="language"
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

        {/* LLM Model */}
        <div className="grid gap-[var(--space-2)]">
          <Label htmlFor="agent_model">Modelo LLM</Label>
          <select
            value={
              POPULAR_MODELS.some((m) => m.id === settings.llm_model)
                ? settings.llm_model
                : '__custom__'
            }
            onChange={(e) => {
              if (e.target.value !== '__custom__') update({ llm_model: e.target.value });
            }}
            className={selectClass}
          >
            {POPULAR_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value="__custom__">Personalizado...</option>
          </select>
          <Input
            id="agent_model"
            value={settings.llm_model}
            onChange={(e) => update({ llm_model: e.target.value })}
            placeholder="vendor/model-name"
            className="font-mono text-xs"
          />
        </div>

        {/* Temperature */}
        <div className="grid gap-[var(--space-2)]">
          <Label>Temperature: {settings.temperature}</Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.temperature}
            onChange={(e) => update({ temperature: Number.parseFloat(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
          <p className="text-xs text-[var(--color-text-muted)]">0 = determinístico, 1 = criativo</p>
        </div>

        {/* Max Tokens */}
        <div className="grid gap-[var(--space-2)]">
          <Label htmlFor="agent_tokens">Max Tokens</Label>
          <Input
            id="agent_tokens"
            type="number"
            value={settings.max_tokens}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value);
              if (!Number.isNaN(val)) update({ max_tokens: val });
            }}
          />
        </div>

        {/* Financial Settings */}
        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Finanças
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
              O agente confirmará gastos acima deste valor
            </p>
          </div>
        </div>

        {/* Automations */}
        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Automações
          </h3>
          <div className="space-y-[var(--space-4)]">
            <div className="flex items-center justify-between">
              <Label>Check-in Matinal</Label>
              <div className="flex items-center gap-[var(--space-2)]">
                <Input
                  type="time"
                  value={settings.checkin_morning_time}
                  onChange={(e) => update({ checkin_morning_time: e.target.value })}
                  className="w-24"
                />
                <Switch
                  checked={settings.checkin_morning_enabled}
                  onCheckedChange={(checked) => update({ checkin_morning_enabled: checked })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Check-in Noturno</Label>
              <div className="flex items-center gap-[var(--space-2)]">
                <Input
                  type="time"
                  value={settings.checkin_evening_time}
                  onChange={(e) => update({ checkin_evening_time: e.target.value })}
                  className="w-24"
                />
                <Switch
                  checked={settings.checkin_evening_enabled}
                  onCheckedChange={(checked) => update({ checkin_evening_enabled: checked })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Review Semanal</Label>
              <div className="flex items-center gap-[var(--space-2)]">
                <Input
                  type="time"
                  value={settings.weekly_review_time}
                  onChange={(e) => update({ weekly_review_time: e.target.value })}
                  className="w-24"
                />
                <Switch
                  checked={settings.weekly_review_enabled}
                  onCheckedChange={(checked) => update({ weekly_review_enabled: checked })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Alertas Diários</Label>
              <div className="flex items-center gap-[var(--space-2)]">
                <Input
                  type="time"
                  value={settings.alerts_time}
                  onChange={(e) => update({ alerts_time: e.target.value })}
                  className="w-24"
                />
                <Switch
                  checked={settings.alerts_enabled}
                  onCheckedChange={(checked) => update({ alerts_enabled: checked })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* System settings */}
        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Sistema
          </h3>
          <div className="space-y-[var(--space-4)]">
            <div className="grid grid-cols-2 gap-[var(--space-4)]">
              <div className="grid gap-[var(--space-2)]">
                <Label htmlFor="agent_hb">Heartbeat (s)</Label>
                <Input
                  id="agent_hb"
                  type="number"
                  value={settings.heartbeat_interval}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value);
                    if (!Number.isNaN(val)) update({ heartbeat_interval: val });
                  }}
                />
              </div>
              <div className="grid gap-[var(--space-2)]">
                <Label htmlFor="agent_ot">Offline threshold (s)</Label>
                <Input
                  id="agent_ot"
                  type="number"
                  value={settings.offline_threshold}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value);
                    if (!Number.isNaN(val)) update({ offline_threshold: val });
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-restart</Label>
              <Switch
                checked={settings.auto_restart}
                onCheckedChange={(checked) => update({ auto_restart: checked })}
              />
            </div>
          </div>
        </div>

        {/* Channels */}
        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Canais
          </h3>
          <div className="space-y-[var(--space-3)]">
            <div className="flex items-center justify-between">
              <Label>Discord</Label>
              <Switch
                checked={settings.enabled_channels.includes('discord')}
                onCheckedChange={(checked) => toggleChannel('discord', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Web</Label>
              <Switch
                checked={settings.enabled_channels.includes('web')}
                onCheckedChange={(checked) => toggleChannel('web', checked)}
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
