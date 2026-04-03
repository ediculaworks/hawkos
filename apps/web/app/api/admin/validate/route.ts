import { NextResponse } from 'next/server';

interface ValidationRequest {
  discordBotToken?: string;
  openrouterApiKey?: string;
}

export async function POST(request: Request) {
  try {
    const body: ValidationRequest = await request.json();
    const { discordBotToken, openrouterApiKey } = body;

    const errors: string[] = [];

    // Validate OpenRouter API key
    if (openrouterApiKey) {
      try {
        const orResponse = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${openrouterApiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!orResponse.ok) {
          errors.push(`OpenRouter API key invalida (status ${orResponse.status})`);
        }
      } catch (orError) {
        errors.push(
          `OpenRouter inacessivel: ${orError instanceof Error ? orError.message : 'timeout'}`,
        );
      }
    }

    // Validate Discord bot token
    if (discordBotToken) {
      try {
        const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${discordBotToken}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!discordResponse.ok) {
          errors.push(`Discord token invalido (status ${discordResponse.status})`);
        }
      } catch (discordError) {
        errors.push(
          `Discord inacessivel: ${discordError instanceof Error ? discordError.message : 'timeout'}`,
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
