/**
 * Extrai o project ref de uma Supabase URL.
 * Ex: "https://abcdef.supabase.co" → "abcdef"
 */
export function extractProjectRef(url: string): string | null {
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

const STORAGE_KEY = 'hawk-onboarding-draft';

/**
 * Lê o draft de onboarding do localStorage.
 * Separa o _step do resto dos dados do formulário.
 */
export function loadOnboardingDraft(): { data: Record<string, unknown>; step: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { data: {}, step: 0 };
    const parsed = JSON.parse(saved);
    const { _step, ...data } = parsed;
    return { data, step: typeof _step === 'number' ? _step : 0 };
  } catch {
    return { data: {}, step: 0 };
  }
}
