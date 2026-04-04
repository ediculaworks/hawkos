# Agentes

## Arquitetura: Hawk + Task Agents

O Hawk OS usa um modelo de **agente único** com **delegação dinâmica**:

- **Hawk** é o único agente persistente e user-facing. Toda conversa — Discord ou web — passa pelo Hawk.
- **Task Agents** são agentes criados pelo Hawk para delegar tarefas específicas. Têm vida curta: criados quando necessário, excluídos ao concluir.

Não há mais personas fixas (CFO, Coach, etc.). O conceito de "selecionar um agente" foi removido da interface.

---

## Hawk

| Campo | Valor |
|-------|-------|
| `id` | `00000000-0000-0000-0000-000000000001` |
| `agent_tier` | `orchestrator` |
| `llm_model` | `null` → usa smart routing via `MODEL_TIER_*` |
| `tools_enabled` | todas |
| `is_user_facing` | `true` |

Hawk é generalista. Acessa todos os módulos, todas as tools, carrega contexto L0/L1/L2 conforme a mensagem. O modelo usado depende da complexidade detectada — veja [Smart Routing](#smart-routing).

---

## Smart Routing (modelo por complexidade)

Cada mensagem é classificada antes de chamar o LLM:

| Complexidade | Critério | Env var |
|---|---|---|
| `simple` | Saudações, CRUD simples (<100 chars, 1 módulo) | `MODEL_TIER_SIMPLE` |
| `moderate` | Padrão | `MODEL_TIER_DEFAULT` |
| `complex` | Multi-módulo, análise, planejamento | `MODEL_TIER_COMPLEX` |

Se as env vars não estiverem definidas, usa `OPENROUTER_MODEL` (default: `openrouter/auto`).

**Cost-aware downgrade**: quando >80% do budget diário é consumido, queries complexas são rebaixadas para moderate. Quando >95%, tudo rebaixa para simple.

```env
MODEL_TIER_SIMPLE=nvidia/nemotron-3-nano-30b-a3b:free
MODEL_TIER_DEFAULT=qwen/qwen3.6-plus:free
MODEL_TIER_COMPLEX=qwen/qwen3.6-plus:free
MODEL_DAILY_BUDGET_USD=5.00
```

---

## Task Agents (delegação dinâmica)

Quando Hawk precisa delegar uma tarefa especializada — análise financeira profunda, geração de imagem, busca de vagas — ele pode criar um **task agent** com escopo limitado.

### Características

- **Escopo restrito**: `tools_enabled` contém apenas as tools necessárias para a tarefa
- **Vida curta**: criado para a tarefa, excluído ao completar (ou manualmente via `/dashboard/agents`)
- **Não user-facing**: `is_user_facing = false` — o usuário não vê nem seleciona estes agentes
- **Modelo específico**: pode ter `llm_model` diferente do Hawk (ex: modelo de visão para imagens)

### Criando um Task Agent

Via `/dashboard/agents/new` ou via tool `create_agent` (futura):

```
Nome:            "Análise Fiscal Q1"
Tier:            specialist
Tools:           get_financial_summary, get_budget_vs_actual, search_documents
Modelo:          qwen/qwen3.6-plus:free
Is user-facing:  false
Tempo de vida:   até conclusão da tarefa
```

### Excluindo

Task agents devem ser excluídos quando a tarefa conclui. Via `/dashboard/agents` → botão Deletar. Hawk pode ser instruído a excluir agents que criou:

```
"Exclui o agente de análise fiscal que você criou semana passada"
```

---

## Workers (internos)

Workers são agentes background usados pelo sistema. Não aparecem no chat, não são user-facing.

| Nome | ID | Função |
|------|-----|--------|
| Memory Extractor | `...0020` | Extrai memórias no fim de sessão |
| Title Generator | `...0021` | Gera títulos de sessão automaticamente |
| Insight Synthesizer | `...0022` | Resume dados para insights proativos |
| Dedup Judge | `...0023` | Deduplica memórias similares |

Estes workers são **permanentes** — usados por automações e pelo session compactor.

---

## Roteamento Discord

O Discord mapeia canais para agentes via `DISCORD_CHANNEL_MAP`. Com o modelo de agente único, todos os canais usam Hawk por padrão:

```env
# Canal principal → Hawk (default, sem configuração necessária)
DISCORD_CHANNEL_ID=1234567890
```

Se um task agent precisar de canal dedicado (caso de uso avançado):

```env
DISCORD_CHANNEL_MAP=9876543210:task-agent-id
```

---

## Como Afeta o Escopo de Tools

O campo `tools_enabled` em qualquer agente funciona como allowlist adicional:

```typescript
// null → todas as tools dos módulos detectados (Hawk padrão)
tools_enabled: null

// array → apenas estas tools (task agent restrito)
tools_enabled: ['get_financial_summary', 'save_memory']
```

O pipeline combina:
1. Tools dos módulos detectados na mensagem (routing dinâmico)
2. Interseção com `tools_enabled` do agente (se não-null)

---

## Gerenciando Agentes

Acesse `/dashboard/agents` para:
- Ver Hawk e workers configurados
- Criar task agents com escopo específico
- Deletar task agents concluídos

> ⚠️ Hawk (`00000000-0000-0000-0000-000000000001`) é protegido e não pode ser deletado.
