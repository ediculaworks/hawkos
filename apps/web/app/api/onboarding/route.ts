import { NextResponse } from 'next/server';

interface OnboardingRequest {
  name: string;
  email: string;
  timezone: string;
  discordServerName: string;
}

export async function POST(request: Request) {
  try {
    const body: OnboardingRequest = await request.json();

    if (!body.name || !body.email || !body.timezone || !body.discordServerName) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const agentPort = 3001 + Math.floor(Math.random() * 100);
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const config = JSON.stringify(
      {
        slug,
        label: body.name,
        supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
        supabaseAnonKey: 'YOUR_ANON_KEY',
        supabaseServiceRoleKey: 'YOUR_SERVICE_ROLE_KEY',
        agentApiPort: agentPort,
        agentApiSecret: secret,
      },
      null,
      2,
    );

    return NextResponse.json({
      success: true,
      slug,
      config,
      instructions: {
        supabase: {
          url: 'https://supabase.com/dashboard/new',
          projectName: `hawk-${slug}`,
          instructions: [
            '1. Crie um novo projeto no Supabase',
            '2. Vá em Settings > API e copie as credenciais',
            '3. Aplique as migrations: bun db:migrate',
          ],
        },
        discord: {
          url: 'https://discord.com/developers/applications',
          instructions: [
            '1. Crie uma nova aplicação',
            '2. Vá em Bot e gere o token',
            '3. Habilite Message Content Intent',
            '4. Use OAuth2 para adicionar ao servidor',
          ],
        },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
  }
}
