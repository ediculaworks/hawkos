import { NextResponse } from 'next/server';

interface ValidationRequest {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  discordBotToken?: string;
  openrouterApiKey?: string;
}

interface JwtPayload {
  iss?: string;
  ref?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
}

function extractProjectRef(url: string): string | null {
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  try {
    const body: ValidationRequest = await request.json();
    const { supabaseUrl, supabaseAnonKey, supabaseServiceKey, discordBotToken, openrouterApiKey } =
      body;

    const errors: string[] = [];

    // --- Validate Supabase credentials if provided ---
    if (supabaseUrl) {
      const urlRef = extractProjectRef(supabaseUrl);
      if (!urlRef) {
        errors.push('URL inválida — use o formato https://xxxx.supabase.co');
      } else {
        if (supabaseAnonKey) {
          const anonPayload = decodeJwtPayload(supabaseAnonKey);
          if (!anonPayload) {
            errors.push('Anon key inválida — não é um JWT válido');
          } else if (anonPayload.ref !== urlRef) {
            errors.push(
              `Anon key é do projeto "${anonPayload.ref}" mas a URL aponta para "${urlRef}"`,
            );
          } else if (anonPayload.role !== 'anon') {
            errors.push(`Anon key tem role "${anonPayload.role}" — use a chave "anon public"`);
          }
        }

        if (supabaseServiceKey) {
          const servicePayload = decodeJwtPayload(supabaseServiceKey);
          if (!servicePayload) {
            errors.push('Service Role key inválida — não é um JWT válido');
          } else if (servicePayload.ref !== urlRef) {
            errors.push(
              `Service Role key é do projeto "${servicePayload.ref}" mas a URL aponta para "${urlRef}"`,
            );
          } else if (servicePayload.role !== 'service_role') {
            errors.push(
              `Service Role key tem role "${servicePayload.role}" — use a chave "service_role secret"`,
            );
          }
        }

        // Quick connectivity check (only if no JWT errors so far)
        if (errors.length === 0) {
          try {
            const pingResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
              signal: AbortSignal.timeout(8000),
            });
            if (pingResponse.status === 404) {
              errors.push('Projeto Supabase não encontrado — verifique a URL');
            }
          } catch (connError) {
            errors.push(
              `Projeto Supabase inacessível: ${connError instanceof Error ? connError.message : 'timeout'}`,
            );
          }
        }
      }
    }

    // --- Validate OpenRouter API key if provided ---
    if (openrouterApiKey) {
      try {
        const orResponse = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${openrouterApiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!orResponse.ok) {
          errors.push(`OpenRouter API key inválida (status ${orResponse.status})`);
        }
      } catch (orError) {
        errors.push(
          `OpenRouter inacessível: ${orError instanceof Error ? orError.message : 'timeout'}`,
        );
      }
    }

    // --- Validate Discord bot token if provided ---
    if (discordBotToken) {
      try {
        const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${discordBotToken}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!discordResponse.ok) {
          errors.push(`Discord token inválido (status ${discordResponse.status})`);
        }
      } catch (discordError) {
        errors.push(
          `Discord inacessível: ${discordError instanceof Error ? discordError.message : 'timeout'}`,
        );
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ valid: false, error: errors.join('; ') });
    }

    return NextResponse.json({ valid: true, message: 'Credenciais validadas com sucesso' });
  } catch (error) {
    console.error('[admin/validate] Error:', error);
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 },
    );
  }
}
