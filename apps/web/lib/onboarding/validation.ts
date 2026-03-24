import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Pelo menos um símbolo (!@#$%...)');

export const emailSchema = z.string().email('Email inválido');

export const cpfSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato 000.000.000-00');

export const slotSchema = z.enum(['TEN1', 'TEN2', 'TEN3', 'TEN4', 'TEN5', 'TEN6']);

export const supabaseUrlSchema = z.string().url('URL do Supabase inválida');

export const apiKeySchema = z.string().min(10, 'Chave de API inválida');

export const discordConfigSchema = z.object({
  botToken: z.string().min(1, 'Bot Token é obrigatório'),
  clientId: z.string().regex(/^\d+$/, 'Client ID deve ser numérico'),
  guildId: z.string().regex(/^\d+$/, 'Guild ID deve ser numérico'),
  channelId: z.string().regex(/^\d+$/, 'Channel ID deve ser numérico'),
  userId: z.string().regex(/^\d+$/, 'User ID deve ser numérico'),
});

export const openRouterConfigSchema = z.object({
  apiKey: z.string().min(10, 'API Key do OpenRouter é obrigatória'),
  model: z.string().optional(),
});

// Step 0: Slot
export const step0Schema = z.object({
  slot: slotSchema,
  supabaseUrl: supabaseUrlSchema.optional(),
  anonKey: z.string().min(10, 'Anon Key inválida').optional(),
  serviceRoleKey: z.string().min(10, 'Service Role Key inválida').optional(),
  isNewSlot: z.boolean(),
});

// Step 1: Account
export const step1Schema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  });

// Step 2: Profile
export const step2Schema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: cpfSchema,
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  timezone: z.string().min(1, 'Timezone é obrigatório'),
});

// Step 3: Integrations
export const step3Schema = z.object({
  openrouter: openRouterConfigSchema,
  discord: discordConfigSchema.optional(),
});

// Step 4: Modules
export const step4Schema = z.object({
  modules: z.array(z.string()),
  agents: z.array(z.string()),
});

// Complete schema
export const onboardingCompleteSchema = z.object({
  slot: slotSchema,
  supabaseUrl: supabaseUrlSchema,
  anonKey: z.string().min(10),
  serviceRoleKey: z.string().min(10),
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2),
  cpf: cpfSchema,
  birthDate: z.string(),
  timezone: z.string(),
  openrouter: openRouterConfigSchema,
  discord: discordConfigSchema.optional(),
  modules: z.array(z.string()),
  agents: z.array(z.string()),
});

// Helper functions
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  return true; // Only format validation, not algorithmic
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Fraca', color: 'var(--color-danger)' };
  if (score <= 4) return { score, label: 'Média', color: 'var(--color-warning)' };
  return { score, label: 'Forte', color: 'var(--color-success)' };
}
