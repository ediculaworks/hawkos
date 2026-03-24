# Variáveis de Ambiente

Todas as variáveis ficam no arquivo `.env` na raiz do monorepo. Nunca commitar este arquivo — use `.env.example` como template.

> ⚠️ **Atenção:** O arquivo `.env` contém credenciais sensíveis (tokens de bot Discord, chaves de banco de dados, chaves de API). Nunca commite esse arquivo no git — ele já está no `.gitignore`. Use o `.env.example` como referência do que preencher.

```bash
cp .env.example .env
# Preencher as variáveis necessárias
```

---

## Supabase

Variáveis para conexão com o banco de dados PostgreSQL via Supabase.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `SUPABASE_URL` | URL da instância Supabase (usada no servidor) | ✅ Sim | — |
| `SUPABASE_ANON_KEY` | Chave anon para acesso RLS (servidor) | ✅ Sim | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (bypass RLS, apenas servidor) | ✅ Sim | — |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase exposta ao browser | ✅ Sim | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon exposta ao browser | ✅ Sim | — |

**Onde encontrar**: [supabase.com](https://supabase.com) → seu projeto → Settings → API.

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## Discord

Variáveis para o bot Discord.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `DISCORD_BOT_TOKEN` | Token do bot Discord | ✅ Sim | — |
| `DISCORD_CLIENT_ID` | Client ID da aplicação Discord | ✅ Sim | — |
| `DISCORD_GUILD_ID` | ID do servidor Discord onde o bot opera | ✅ Sim | — |
| `DISCORD_CHANNEL_ID` | Canal padrão do agente principal | ✅ Sim | — |
| `DISCORD_AUTHORIZED_USER_ID` | ID do usuário autorizado a interagir com o bot | ✅ Sim | — |
| `DISCORD_CHANNEL_MAP` | Mapeamento canal → template de agente | ⚪ Não | — |

**DISCORD_CHANNEL_MAP formato**:
```env
DISCORD_CHANNEL_MAP=1234567890:hawk-default,9876543210:cfo-template,1111111111:coach-template
# channelId:agentTemplateId separados por vírgula
```

**Onde encontrar**: [discord.com/developers/applications](https://discord.com/developers/applications).

---

## AI / LLM

Variáveis para o modelo de linguagem.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `OPENROUTER_API_KEY` | Chave da API OpenRouter (roteador de LLMs) | ✅ Sim | — |
| `OPENROUTER_MODEL` | Modelo a usar via OpenRouter | ⚪ Não | `openrouter/auto` |
| `OPENROUTER_MAX_TOKENS` | Máximo de tokens na resposta | ⚪ Não | `4096` |
| `ANTHROPIC_API_KEY` | Chave Anthropic (uso direto, opcional) | ⚪ Não | — |
| `ANTHROPIC_MODEL` | Modelo Anthropic para uso direto | ⚪ Não | `claude-sonnet-4-6` |

**Sobre OpenRouter**: O Hawk OS usa OpenRouter como abstração. `openrouter/auto` seleciona automaticamente o modelo mais adequado por custo/performance. Você pode fixar um modelo específico:

```env
OPENROUTER_MODEL=anthropic/claude-sonnet-4-6
# ou
OPENROUTER_MODEL=openai/gpt-4o
# ou
OPENROUTER_MODEL=google/gemini-2.0-flash
```

**Onde encontrar**: [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Google (Calendar)

Variáveis para integração com Google Calendar.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `GOOGLE_CLIENT_ID` | OAuth Client ID do Google Cloud | ⚪ Opcional | — |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret | ⚪ Opcional | — |
| `GOOGLE_REDIRECT_URI` | URI de callback OAuth | ⚪ Opcional | `http://localhost:3000/api/auth/google/callback` |

**Setup no Google Cloud**:
1. Criar projeto no [console.cloud.google.com](https://console.cloud.google.com)
2. Habilitar Google Calendar API
3. Criar credenciais OAuth 2.0 (tipo: Web Application)
4. Adicionar redirect URI autorizado

A integração Google Calendar é opcional — o módulo de calendário funciona sem ela (apenas dados internos).

---

## Storage (Cloudflare R2)

Para armazenamento de documentos e backups.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `R2_ACCOUNT_ID` | ID da conta Cloudflare | ⚪ Opcional | — |
| `R2_ACCESS_KEY_ID` | Access Key do R2 | ⚪ Opcional | — |
| `R2_SECRET_ACCESS_KEY` | Secret Key do R2 | ⚪ Opcional | — |
| `R2_BUCKET` | Nome do bucket R2 | ⚪ Opcional | `backups` |

Usado para: backups do banco, documentos do módulo assets, uploads de usuário.

---

## Aplicação

Variáveis gerais da aplicação.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `NODE_ENV` | Ambiente de execução | ⚪ Não | `development` |
| `APP_URL` | URL base do servidor (usada em callbacks) | ✅ Prod | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | URL base exposta ao browser | ✅ Prod | `http://localhost:3000` |

---

## Agent API

O agente expõe uma API HTTP interna para comunicação com o dashboard web.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `AGENT_API_PORT` | Porta da API HTTP do agente | ⚪ Não | `3001` |
| `AGENT_API_SECRET` | Segredo para autenticar requests à API do agente | ✅ Sim | — |
| `NEXT_PUBLIC_AGENT_API_TOKEN` | Token para o dashboard chamar a API do agente | ✅ Sim | — |

**Como funciona**: O dashboard Next.js chama `http://localhost:3001` (ou a URL configurada em produção) para enviar mensagens ao agente e receber respostas via streaming. O `AGENT_API_SECRET` valida que apenas o dashboard pode chamar o agente.

---

## Voice (Transcrição)

Para transcrição de áudio via Discord voice messages.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `GROQ_API_KEY` | Chave da API Groq (Whisper para transcrição rápida) | ⚪ Opcional | — |

Quando configurado, mensagens de voz enviadas no Discord são transcritas automaticamente antes de serem processadas pelo agente.

**Onde encontrar**: [console.groq.com](https://console.groq.com).

---

## Heartbeat / Automações

Controla o comportamento proativo do agente.

| Variável | Propósito | Obrigatória | Valor padrão |
|----------|-----------|-------------|--------------|
| `HEARTBEAT_PROFILE` | Perfil de proatividade do agente | ⚪ Não | `companion` |
| `HEARTBEAT_ACTIVE_HOURS` | Janela de horas em que o agente pode enviar mensagens proativas | ⚪ Não | `08:00-22:00` |

**HEARTBEAT_PROFILE opções**:
- `guardian`: máxima proatividade — alerta sobre tudo, check-ins frequentes
- `companion`: balanceado — alertas importantes + check-ins diários (recomendado)
- `silent`: mínimo — apenas responde quando chamado, sem mensagens proativas

**HEARTBEAT_ACTIVE_HOURS**: O agente nunca envia mensagens proativas fora desta janela, evitando notificações no meio da noite.

```env
HEARTBEAT_PROFILE=companion
HEARTBEAT_ACTIVE_HOURS=08:00-22:00
```

---

## Exemplo de .env Completo

```env
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Discord
DISCORD_BOT_TOKEN=Bot xxxx...
DISCORD_CLIENT_ID=123456789
DISCORD_GUILD_ID=987654321
DISCORD_CHANNEL_ID=111111111
DISCORD_AUTHORIZED_USER_ID=999999999
DISCORD_CHANNEL_MAP=111111111:hawk-default,222222222:cfo-template

# AI
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_MAX_TOKENS=4096

# App
NODE_ENV=development
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Agent API
AGENT_API_PORT=3001
AGENT_API_SECRET=seu-segredo-aqui
NEXT_PUBLIC_AGENT_API_TOKEN=seu-token-aqui

# Heartbeat
HEARTBEAT_PROFILE=companion
HEARTBEAT_ACTIVE_HOURS=08:00-22:00
```

---

## Segurança

- **Nunca commitar `.env`**: está no `.gitignore`
- **Use `.env.example`** para documentar variáveis sem valores reais
- **`SUPABASE_SERVICE_ROLE_KEY`**: nunca expor ao browser — apenas usar no servidor
- **`AGENT_API_SECRET`**: deve ser uma string longa e aleatória em produção
- Rotacione chaves periodicamente, especialmente se suspeitar de vazamento
