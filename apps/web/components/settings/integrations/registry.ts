import type { IntegrationProvider } from '@hawk/admin';
import {
  Bot,
  Brain,
  Cpu,
  type LucideIcon,
  Mic,
  Plug,
  Route,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: { value: string; label: string }[];
}

export interface IntegrationDefinition {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  fields: IntegrationField[];
  testable: boolean;
}

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  {
    provider: 'discord',
    name: 'Discord',
    description: 'Canal principal do agente',
    icon: Bot,
    color: '#5865F2',
    testable: true,
    fields: [
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        required: true,
        placeholder: 'MTI...',
      },
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: '123456789...' },
      {
        key: 'guild_id',
        label: 'Guild ID',
        type: 'text',
        required: true,
        placeholder: '123456789...',
      },
      { key: 'channel_id', label: 'Channel ID', type: 'text', placeholder: '123456789...' },
      {
        key: 'authorized_user_id',
        label: 'Authorized User ID',
        type: 'text',
        placeholder: '123456789...',
      },
    ],
  },
  {
    provider: 'openrouter',
    name: 'OpenRouter',
    description: 'LLM principal do agente',
    icon: Route,
    color: '#6366F1',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-or-...',
      },
      {
        key: 'model',
        label: 'Modelo',
        type: 'select',
        options: [
          { value: 'qwen/qwen3.6-plus:free', label: 'Qwen 3.6 Plus (gratuito)' },
          { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
          { value: 'anthropic/claude-haiku-4', label: 'Claude Haiku 4' },
          { value: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash' },
          { value: 'openai/gpt-4.1', label: 'GPT-4.1' },
          { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
        ],
      },
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', placeholder: '4096' },
    ],
  },
  {
    provider: 'anthropic',
    name: 'Anthropic',
    description: 'API direta da Anthropic',
    icon: Brain,
    color: '#D97757',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...',
      },
      {
        key: 'model',
        label: 'Modelo',
        type: 'select',
        options: [
          { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
          { value: 'claude-haiku-4-20250414', label: 'Claude Haiku 4' },
        ],
      },
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', placeholder: '4096' },
    ],
  },
  {
    provider: 'groq',
    name: 'Groq',
    description: 'LLM ultra-rápido (500+ tok/s) + Whisper transcrição',
    icon: Mic,
    color: '#F55036',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'gsk_...',
        helpText: 'Grátis em console.groq.com — 30 RPM no free tier',
      },
    ],
  },
  {
    provider: 'xai',
    name: 'x.AI (Grok)',
    description: 'Grok 3 / Grok 3 Mini',
    icon: Sparkles,
    color: '#1DA1F2',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'xai-...',
      },
    ],
  },
  {
    provider: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'Nemotron, Llama via NVIDIA Cloud',
    icon: Cpu,
    color: '#76B900',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'nvapi-...',
        helpText: 'Grátis em build.nvidia.com — alguns modelos free',
      },
    ],
  },
  {
    provider: 'google_ai',
    name: 'Google AI Studio',
    description: 'Gemini 2.5 Flash / Gemini 2.0',
    icon: Sun,
    color: '#4285F4',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'AIza...',
        helpText: 'Grátis em aistudio.google.com — 15 RPM, 1M tokens/dia',
      },
    ],
  },
  {
    provider: 'together',
    name: 'Together AI',
    description: 'Llama, Qwen, Mistral em infra rápida',
    icon: Zap,
    color: '#0066FF',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'tok_...',
      },
    ],
  },
  {
    provider: 'cerebras',
    name: 'Cerebras',
    description: 'Inferência ultra-rápida em hardware Cerebras',
    icon: Cpu,
    color: '#FF6B00',
    testable: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'csk-...',
        helpText: 'Free tier disponível em cloud.cerebras.ai',
      },
    ],
  },
  {
    provider: 'github',
    name: 'GitHub',
    description: 'Repositórios, issues e PRs',
    icon: Plug,
    color: '#8B5CF6',
    testable: true,
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        type: 'password',
        required: true,
        placeholder: 'ghp_...',
      },
      { key: 'owner', label: 'Owner / Org', type: 'text', placeholder: 'meu-usuario' },
    ],
  },
  {
    provider: 'clickup',
    name: 'ClickUp',
    description: 'Tasks e projetos',
    icon: Zap,
    color: '#7B68EE',
    testable: true,
    fields: [
      {
        key: 'api_token',
        label: 'API Token',
        type: 'password',
        required: true,
        placeholder: 'pk_...',
      },
      { key: 'workspace_id', label: 'Workspace ID', type: 'text', placeholder: '12345678' },
      { key: 'team_id', label: 'Team ID', type: 'text', placeholder: '12345678' },
    ],
  },
  {
    provider: 'google',
    name: 'Google Calendar',
    description: 'Sincronização de eventos e agenda',
    icon: Plug,
    color: '#4285F4',
    testable: false,
    fields: [],
  },
];
