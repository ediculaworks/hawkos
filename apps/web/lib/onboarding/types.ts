export interface TenantSlot {
  name: string;
  configured: boolean;
  occupied: boolean;
  occupiedBy?: string;
  supabaseUrl?: string;
}

export interface DiscordConfig {
  botToken: string;
  clientId: string;
  guildId: string;
  channelId: string;
  userId: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
}

export interface OnboardingFormData {
  slot: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  email: string;
  password: string;
  name: string;
  cpf: string;
  birthDate: string;
  timezone: string;
  discord?: DiscordConfig;
  openrouter: OpenRouterConfig;
  modules: string[];
  agents: string[];
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'slot', title: 'Início', description: 'Bem-vindo ao Hawk OS' },
  { id: 'account', title: 'Conta', description: 'Crie sua conta' },
  { id: 'profile', title: 'Perfil', description: 'Seus dados pessoais' },
  { id: 'integrations', title: 'Integrações', description: 'Conecte serviços' },
  { id: 'modules', title: 'Módulos', description: 'Escolha funcionalidades' },
  { id: 'configure', title: 'Configurar', description: 'Aguarde...' },
  { id: 'complete', title: 'Concluir', description: 'Tudo pronto!' },
];

export const MODULES = [
  { id: 'finances', name: 'Finanças', description: 'Transações e contas', category: 'core' },
  { id: 'health', name: 'Saúde', description: 'Treino, sono, corpo', category: 'core' },
  { id: 'objectives', name: 'Objetivos', description: 'Metas e tarefas', category: 'core' },
  { id: 'routine', name: 'Rotinas', description: 'Hábitos e streaks', category: 'core' },
  { id: 'people', name: 'Pessoas', description: 'CRM e contatos', category: 'life' },
  { id: 'career', name: 'Carreira', description: 'Trabalho e projetos', category: 'life' },
  { id: 'calendar', name: 'Calendário', description: 'Eventos e agenda', category: 'life' },
  { id: 'assets', name: 'Patrimônio', description: 'Bens e documentos', category: 'other' },
  { id: 'housing', name: 'Moradia', description: 'Contas e manutenção', category: 'other' },
  { id: 'legal', name: 'Legal', description: 'Contratos e obrigações', category: 'other' },
  {
    id: 'entertainment',
    name: 'Entretenimento',
    description: 'Mídia e hobbies',
    category: 'other',
  },
] as const;

export const AGENTS = [
  { id: 'bull', name: 'Bull', description: 'Finanças, patrimônio e legal' },
  { id: 'wolf', name: 'Wolf', description: 'Saúde, rotina e hábitos' },
  { id: 'owl', name: 'Owl', description: 'Carreira e desenvolvimento' },
  { id: 'bee', name: 'Bee', description: 'Agenda e produtividade' },
  { id: 'beaver', name: 'Beaver', description: 'Moradia e segurança' },
  { id: 'fox', name: 'Fox', description: 'Entretenimento e social' },
  { id: 'peacock', name: 'Peacock', description: 'Geração de imagens' },
] as const;

export const TIMEZONES = [
  { id: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { id: 'America/New_York', label: 'New York (GMT-5)' },
  { id: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { id: 'America/Denver', label: 'Denver (GMT-7)' },
  { id: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { id: 'Europe/London', label: 'London (GMT+0)' },
  { id: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { id: 'Europe/Berlin', label: 'Berlin (GMT+1)' },
  { id: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { id: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { id: 'Australia/Sydney', label: 'Sydney (GMT+10)' },
] as const;

export const OPENROUTER_MODELS = [
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B' },
  { id: 'arcee-ai/trinity-large-preview:free', label: 'Trinity Large (Arcee AI)' },
  { id: 'stepfun/step-3.5-flash:free', label: 'Step 3.5 Flash' },
  { id: 'minimax/minimax-m2.5:free', label: 'MiniMax M2.5' },
  { id: 'sourceful/riverflow-v2-pro', label: 'Riverflow v2 Pro' },
  { id: 'sourceful/riverflow-v2-fast', label: 'Riverflow v2 Fast' },
  { id: 'nvidia/llama-nemotron-embed-vl-1b-v2:free', label: 'Llama Nemotron Embed 1B' },
  { id: '__manual__', label: 'Digitar manualmente...' },
] as const;
