# Variáveis de Ambiente

Todas as variáveis ficam no arquivo `.env` na raiz do monorepo. Nunca commitar este arquivo — use `.env.example` como template.

> ⚠️ **Atenção:** O arquivo `.env` contém credenciais sensíveis (tokens de bot Discord, chaves de banco de dados, chaves de API). Nunca commite esse arquivo no git — ele já está no `.gitignore`. Use o `.env.example` como referência do que preencher.

```bash
cp .env.example .env
# Preencher as variáveis necessárias
```

---

## PostgreSQL

Variáveis para conexão direta com o banco de dados PostgreSQL.

| Variável | Propósito | Obrigatória | Valor padrão |
| -------- | --------- | ----------- | ------------ |
| `DATABASE_URL` | Conexão direta PostgreSQL (migrations, admin) | ✅ Sim | — |
| `DATABASE_POOL_URL` | Conexão via PgBouncer (aplicação) | ✅ Sim | — |
| `POSTGRES_USER` | Usuário PostgreSQL no Docker | ✅ Sim | — |
| `POSTGRES_PASSWORD` | Senha PostgreSQL no Docker | ✅ Sim | — |

```env
DATABASE_URL=postgres://hawkos:your-password@localhost:5432/hawkos
DATABASE_POOL_URL=postgres://hawkos:your-password@localhost:6432/hawkos
POSTGRES_USER=hawkos
POSTGRES_PASSWORD=your-secure-password
```

---

## Autenticação

| Variável | Propósito | Obrigatória | Valor padrão |
| -------- | --------- | ----------- | ------------ |
| `JWT_SECRET` | Secret para assinar JWTs (mínimo 32 chars) | ✅ Sim | — |
| `ADMIN_MASTER_KEY` | Chave para encriptar secrets de tenants (Discord tokens, API keys) | ✅ Sim | — |

```env
JWT_SECRET=your-jwt-secret-at-least-32-chars
ADMIN_MASTER_KEY=your-admin-master-key
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
DISCORD_CHANNEL_MAP=1234567890:agent-uuid-aqui
# channelId:agentId separados por vírgula (caso avançado — todos os canais usam Hawk por padrão)
```

**Onde encontrar**: [discord.com/developers/applications](https://discord.com/developers/applications).

---

## AI / LLM

Variáveis para o modelo de linguagem.

| Variável | Propósito | Obrigatória | Valor padrão |
| -------- | --------- | ----------- | ------------ |
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

## Model Tiers (Smart Routing)

O sistema classifica cada mensagem por complexidade e seleciona o modelo adequado. Estas variáveis configuram os modelos por tier.

| Variável | Propósito | Obrigatória | Valor padrão |
| -------- | --------- | ----------- | ------------ |
| `MODEL_TIER_SIMPLE` | Modelo para queries simples (cumprimentos, CRUD) | ⚪ Não | modelo do agente |
| `MODEL_TIER_DEFAULT` | Modelo para queries moderadas | ⚪ Não | modelo do agente |
| `MODEL_TIER_COMPLEX` | Modelo para raciocínio complexo (multi-módulo, análise) | ⚪ Não | modelo do agente |
| `MODEL_DAILY_BUDGET_USD` | Limite diário de custo por tenant (ex: `5.00`) | ⚪ Não | sem limite |
| `OLLAMA_BASE_URL` | URL do servidor Ollama local (ativa inferência local gratuita) | ⚪ Não | — |
| `OLLAMA_WORKER_MODEL` | Modelo Ollama para workers quando `OLLAMA_BASE_URL` está set | ⚪ Não | `gemma4:e2b` |
| `MEMORY_WORKER_MODEL` | Modelo OpenRouter para workers (quando sem Ollama) | ⚪ Não | `nvidia/nemotron-nano-9b-v2:free` |

**Cost-aware downgrade**: Quando >80% do budget diário é consumido, queries complexas são rebaixadas para moderate. Quando >95%, tudo é rebaixado para simple.

Se `OLLAMA_BASE_URL` estiver configurado, `gemma4:e2b` é usado como padrão para simple, moderate e todos os workers (gratuito). Sem Ollama, usa modelos free do OpenRouter.

```env
# Com Ollama local (recomendado em VPS)
OLLAMA_BASE_URL=http://ollama:11434/v1
OLLAMA_WORKER_MODEL=gemma4:e2b

# Sem Ollama (apenas OpenRouter)
MODEL_TIER_SIMPLE=nvidia/nemotron-3-nano-30b-a3b:free
MODEL_TIER_DEFAULT=qwen/qwen3.6-plus:free
MODEL_TIER_COMPLEX=qwen/qwen3.6-plus:free
MODEL_DAILY_BUDGET_USD=5.00
MEMORY_WORKER_MODEL=nvidia/nemotron-nano-9b-v2:free
```

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

## Extensions (GitHub, ClickUp)

Integrações com serviços externos.

| Variável | Propósito | Obrigatória | Valor padrão |
| -------- | --------- | ----------- | ------------ |
| `GITHUB_USERNAME` | Username do GitHub para sync | ⚪ Opcional | — |
| `GITHUB_CLIENT_ID` | OAuth Client ID do GitHub | ⚪ Opcional | — |
| `GITHUB_CLIENT_SECRET` | OAuth Client Secret do GitHub | ⚪ Opcional | — |
| `CLICKUP_CLIENT_ID` | OAuth Client ID do ClickUp | ⚪ Opcional | — |
| `CLICKUP_CLIENT_SECRET` | OAuth Client Secret do ClickUp | ⚪ Opcional | — |

---

## Multi-Tenant

Variáveis para o sistema multi-tenant.

| Variável | Propósito | Obrigatória | Valor padrão |
| -------- | --------- | ----------- | ------------ |
| `TENANT_SCHEMA` | Schema PostgreSQL (single-tenant mode) | ⚪ Não | — |
| `AGENT_SLOT` | ⚠️ Deprecated — slot para modo legacy (ten1, ten2, etc.) | ⚪ Não | — |
| `ONBOARDING_MASTER_PASSWORD` | Password para reset de conta admin | ⚪ Não | — |
| `DOMAIN` | Domínio para Caddy HTTPS (produção) | ⚪ Prod | — |

> ⚠️ **Atenção:** `AGENT_SLOT` é deprecated. O sistema multi-tenant agora carrega tenants dinamicamente da tabela `admin.tenants`. Use `AGENT_SLOT` apenas para compatibilidade legacy.

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
# PostgreSQL
DATABASE_URL=postgres://hawkos:your-password@localhost:5432/hawkos
DATABASE_POOL_URL=postgres://hawkos:your-password@localhost:6432/hawkos
POSTGRES_USER=hawkos
POSTGRES_PASSWORD=your-secure-password

# Auth
JWT_SECRET=your-jwt-secret-at-least-32-chars
ADMIN_MASTER_KEY=your-admin-master-key

# Discord
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=123456789
DISCORD_GUILD_ID=987654321
DISCORD_CHANNEL_ID=111111111
DISCORD_AUTHORIZED_USER_ID=999999999

# AI — OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_MAX_TOKENS=4096

# AI — Anthropic (opcional)
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# Model Tiers (opcional)
# MODEL_TIER_SIMPLE=nvidia/nemotron-3-nano-30b-a3b:free
# MODEL_TIER_DEFAULT=qwen/qwen3.6-plus:free
# MODEL_TIER_COMPLEX=qwen/qwen3.6-plus:free
# MODEL_DAILY_BUDGET_USD=5.00

# App
NODE_ENV=development
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
# DOMAIN=hawk.meudominio.com

# Agent API
AGENT_API_PORT=3001
AGENT_API_SECRET=seu-segredo-aqui
NEXT_PUBLIC_AGENT_API_TOKEN=seu-token-aqui

# Voice (opcional)
# GROQ_API_KEY=your-groq-api-key

# Heartbeat
HEARTBEAT_PROFILE=companion
HEARTBEAT_ACTIVE_HOURS=08:00-22:00

# Onboarding
# ONBOARDING_MASTER_PASSWORD=your-master-password
```

---

## Segurança

- **Nunca commitar `.env`**: está no `.gitignore`
- **Use `.env.example`** para documentar variáveis sem valores reais
- **`SUPABASE_SERVICE_ROLE_KEY`**: nunca expor ao browser — apenas usar no servidor
- **`AGENT_API_SECRET`**: deve ser uma string longa e aleatória em produção
- Rotacione chaves periodicamente, especialmente se suspeitar de vazamento
