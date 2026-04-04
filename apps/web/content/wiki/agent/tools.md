# Tools do Agente

## O que sao Tools

Tools sao funcoes que o LLM pode chamar para ler ou escrever dados. Quando voce diz "registra que fui na academia", o LLM nao "escreve" nada por conta propria — ele gera uma chamada de tool (`log_habit` ou `log_workout`) e o sistema executa a operacao no banco.

Isso garante que:

1. Dados estruturados vao para as tabelas corretas
2. Operacoes sao validadas antes de executar (Zod schemas)
3. O LLM nao pode fazer nada que o codigo nao permite explicitamente
4. Toda acao fica registrada no `activity_log`
5. Tools perigosas requerem confirmacao do usuario

> 🧩 **Para leigos:** Imagine que o agente e um gerente de escritorio super inteligente, mas ele nao tem acesso direto aos arquivos. Para arquivar algo, ele precisa pedir pra uma secretaria especifica (a "tool"). Isso garante que nada e guardado no lugar errado e tudo fica registrado.

## Estrutura Modular

As tools vivem em `apps/agent/src/tools/` como ficheiros separados por modulo:

```text
apps/agent/src/tools/
├── index.ts          ← agrega todas as tools + getToolsForModules()
├── types.ts          ← ToolDefinition type
├── finances.ts       ← tools de financas
├── health.ts         ← tools de saude
├── routine.ts        ← tools de habitos
├── objectives.ts     ← tools de objetivos/tarefas
├── people.ts         ← tools de pessoas/CRM
├── calendar.ts       ← tools de agenda
├── career.ts         ← tools de carreira
├── media.ts          ← tools de entretenimento
├── demands.ts        ← tools de demandas
├── knowledge.ts      ← tools de conhecimento
├── analytics.ts      ← tools de analytics
├── universal.ts      ← tools universais (save_memory, etc.)
├── web.ts            ← web search + page extraction
├── extensions.ts     ← GitHub, ClickUp integrations
├── github.ts         ← git/GitHub operations
├── git.ts            ← git commands
├── filesystem.ts     ← file operations
├── shell.ts          ← shell commands
└── other-modules.ts  ← housing, assets, legal, etc.
```

Cada ficheiro exporta um objeto `Record<string, ToolDefinition>`. O `index.ts` agrega todos num unico `TOOLS` record.

## ToolDefinition

```typescript
// apps/agent/src/tools/types.ts

type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;     // JSON Schema
  modules: ModuleId[];                      // [] = universal
  dangerous?: boolean;                      // requer confirmacao
  handler: (args: any) => Promise<string>;
};
```

Campos importantes:

- **`modules`** — Lista de modulos aos quais a tool pertence. `[]` significa universal (sempre disponivel)
- **`dangerous`** — Se `true`, o sistema pede confirmacao ao usuario antes de executar (feature flag `tool-approval`)
- **`description`** — Critico: o LLM usa isso para decidir quando chamar a tool

## Tool Routing Dinamico

O Hawk OS tem 40+ tools, mas enviar todas a cada chamada LLM seria desperdicio. O sistema filtra dinamicamente:

```typescript
// apps/agent/src/tools/index.ts

export function getToolsForModules(detectedModules: string[]): {
  tools: OpenAI.ChatCompletionTool[];
  toolMap: Map<string, ToolDefinition>;
} {
  const detected = new Set(detectedModules);

  const filtered = Object.values(TOOLS).filter(tool => {
    // Universal tools: sempre inclui
    if (tool.modules.length === 0) return true;
    // Module-specific: inclui se algum modulo bate
    return tool.modules.some(m => detected.has(m));
  });

  return { tools: filtered.map(toOpenAI), toolMap: new Map(filtered.map(t => [t.name, t])) };
}
```

**Resultado pratico**: Uma mensagem sobre financas carrega ~8 tools (finances + universais). Uma mensagem sobre agenda carrega ~5 tools. Uma mensagem generica carrega apenas as universais.

> 💡 **Dica:** Se o agente nao encontrar uma tool que precisa (ex: voce fala de treino mas o agente nao carregou tools de health), voce pode dizer "use as tools de saude". O middleware de routing redetecta os modulos necessarios.

## Tool Approval

Tools marcadas com `dangerous: true` passam por um sistema de confirmacao:

1. LLM chama a tool → sistema detecta que e perigosa
2. Retorna aviso ao usuario pedindo confirmacao
3. Usuario confirma → segunda chamada executa a tool
4. Aprovacoes expiram apos 5 minutos
5. Eventos `tool_approved` / `tool_denied` logados no `activity_log`

Controlado pela feature flag `tool-approval`.

## Tools Universais

Sempre disponiveis, independente do modulo ou agente:

### `save_memory`

Salva uma memoria permanente no banco com embedding vetorial.

```typescript
save_memory({
  content: string,
  memory_type: 'profile' | 'preference' | 'entity' | 'event' | 'case' | 'pattern' | 'procedure',
  module?: string,
  importance?: number,   // 1-10 (default 5)
  confidence?: number,   // 0.0-1.0 (default 0.8)
})
```

Os 7 tipos de memoria:

| Tipo | O que guarda |
| ---- | ------------ |
| `profile` | Fatos sobre identidade (idade, profissao, localizacao) |
| `preference` | Preferencias (comunicacao, horarios, ferramentas) |
| `entity` | Pessoas, empresas, projetos nomeados |
| `event` | Marcos e ocorrencias significativas |
| `case` | Situacoes + aprendizados (correcao de erros) |
| `pattern` | Padroes comportamentais recorrentes |
| `procedure` | Regras aprendidas / comportamentos corrigidos |

O campo `confidence` indica certeza: 1.0 = afirmado diretamente pelo usuario, 0.5 = implicito, 0.3 = incerto.

### `call_agent`

Consulta outro agente especialista e retorna a resposta.

```typescript
call_agent({
  agent_id: string,      // UUID do agente destino
  query: string,         // pergunta ou tarefa
  session_context?: string,
})
```

### `handoff_to_agent`

Transfere a conversa para outro agente. A proxima mensagem sera respondida pelo agente destino.

### `explore_memory_graph`

Explora o grafo de conhecimento a partir de uma memoria, retornando memorias conectadas por ate N saltos (BFS multi-hop).

```typescript
explore_memory_graph({
  memory_id: string,     // UUID da memoria raiz
  max_hops?: number,     // 1-3, default 2
})
```

### `ask_deepening_question` / `mark_question_answered`

Ferramentas do fluxo de onboarding — buscam perguntas de aprofundamento para conhecer melhor o usuario.

### `lookup_cep` / `lookup_cnpj`

Consultas a BrasilAPI para buscar enderecos por CEP e dados de empresas por CNPJ.

## Tools por Modulo

### Financas (`finances`)

| Tool | O que faz |
| ---- | --------- |
| `create_transaction` | Registra receita ou despesa com categoria, conta, data |
| `get_financial_summary` | Saldo total, gastos do mes, orcamento vs real |
| `get_budget_vs_actual` | Comparacao por categoria no periodo |
| `get_categories` | Lista categorias disponiveis para classificacao |
| `get_accounts` | Lista contas com saldos atuais |
| `get_portfolio_positions` | Posicoes de investimento |

### Saude (`health`)

| Tool | O que faz |
| ---- | --------- |
| `log_workout` | Cria sessao de treino (tipo, duracao, notas) |
| `add_workout_set` | Adiciona serie a um treino (exercicio, peso, reps) |
| `log_sleep` | Registra sono (inicio, fim, qualidade) |
| `log_weight` | Registra peso corporal |
| `get_exercise_progress` | Historico de progresso num exercicio especifico |
| `estimate_1rm` | Calcula 1RM estimado baseado em serie registrada |

### Objetivos (`objectives`)

| Tool | O que faz |
| ---- | --------- |
| `create_objective` | Cria meta/objetivo com prazo e area |
| `create_task` | Cria tarefa vinculada a um objetivo |

### Pessoas (`people`)

| Tool | O que faz |
| ---- | --------- |
| `create_person` | Adiciona pessoa ao CRM |
| `find_person_by_name` | Busca pessoa por nome (fuzzy) |
| `log_interaction` | Registra interacao com pessoa (ligacao, mensagem, encontro) |

### Rotina (`routine`)

| Tool | O que faz |
| ---- | --------- |
| `create_habit` | Cria novo habito com frequencia e meta |
| `find_habit_by_name` | Busca habito por nome (fuzzy) |
| `log_habit` | Marca habito como feito (com notas opcionais) |
| `get_habits_at_risk` | Lista habitos com streak em risco de quebrar |

### Agenda (`calendar`)

| Tool | O que faz |
| ---- | --------- |
| `create_event` | Cria evento com titulo, data, duracao, participantes |
| `find_free_slots` | Encontra slots livres num periodo |

### Carreira (`career`)

| Tool | O que faz |
| ---- | --------- |
| `log_work` | Registra sessao de trabalho (workspace, duracao, tarefas) |
| `find_workspace_by_name` | Busca workspace/projeto por nome |

### Entretenimento (`media`)

| Tool | O que faz |
| ---- | --------- |
| `create_media` | Adiciona filme, serie, musica, livro a lista |

### Patrimonio (`assets`)

| Tool | O que faz |
| ---- | --------- |
| `search_documents` | Busca documentos no acervo |

### Web (`web`)

| Tool | O que faz |
| ---- | --------- |
| `web_search` | Busca na web via Brave Search ou DuckDuckGo (fallback) |
| `extract_page` | Extrai conteudo de URL como Markdown (Readability + Turndown) |

A tool `extract_page` usa validacao SSRF para bloquear IPs privados e metadata endpoints. Suporta formatos: `markdown`, `text`, `raw`.

### Analytics

| Tool | O que faz |
| ---- | --------- |
| `get_weekly_summary` | Resumo semanal com metricas de todos os modulos |
| `get_module_trends` | Tendencias e padroes de um modulo especifico |

### Demandas (`demands`)

| Tool | O que faz |
| ---- | --------- |
| `create_demand` | Cria demanda para tarefa complexa |
| `update_demand` | Atualiza status de demanda |

## Criando uma Nova Tool

Para adicionar uma tool ao sistema:

1. Criar ou editar o ficheiro do modulo em `apps/agent/src/tools/`
2. Definir a tool seguindo o type `ToolDefinition`
3. Exportar do ficheiro e importar no `index.ts`

```typescript
// apps/agent/src/tools/my-module.ts

import type { ToolDefinition } from './types.js';

export const myModuleTools: Record<string, ToolDefinition> = {
  my_new_tool: {
    name: 'my_new_tool',
    modules: ['finances'],      // ou [] para universal
    description: 'Descricao clara do que a tool faz e quando usar',
    dangerous: false,           // true se modifica dados criticos
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Valor em reais' },
        category: {
          type: 'string',
          description: 'Categoria da transacao',
          enum: ['alimentacao', 'transporte', 'lazer'],
        },
      },
      required: ['amount'],
    },
    handler: async (args: { amount: number; category?: string }) => {
      const result = await createTransaction({ amount: args.amount, category: args.category });
      return `Transacao de R$${args.amount} registrada. ID: ${result.id}`;
    },
  },
};
```

Depois, importar no `index.ts`:

```typescript
// apps/agent/src/tools/index.ts
import { myModuleTools } from './my-module.js';

export const TOOLS: Record<string, ToolDefinition> = {
  ...financeTools,
  // ...outros
  ...myModuleTools,
};
```

**Checklist para nova tool:**

- [ ] `name` unico e descritivo (snake_case)
- [ ] `modules` correto (ou `[]` para universal)
- [ ] `description` clara — o LLM usa isso para decidir quando chamar
- [ ] `parameters` bem tipados com descriptions (JSON Schema)
- [ ] `handler` retorna string descritiva do resultado
- [ ] `dangerous: true` se modifica dados criticos ou faz operacoes irreversiveis
- [ ] Usa queries do modulo, nao acessa banco diretamente
- [ ] Erros sao capturados e retornados como string de erro

> ⚠️ **Atencao:** A `description` da tool e critica. E o que o LLM le para decidir se deve chamar aquela tool ou nao. Uma description vaga ou confusa faz o LLM escolher a tool errada ou nao chamar quando deveria.

## Fluxo de Execucao das Tools

```text
LLM retorna tool_calls
         │
         ▼
Promise.allSettled([executeToolCall(tc) for tc in tool_calls])
         │
         ├─ Valida parametros (Zod schema)
         ├─ Verifica tool approval (se dangerous)
         ├─ Chama handler(args)
         ├─ Loga no activity_log
         └─ Retorna resultado como string
         │
         ▼
Adiciona ao historico de tools:
  { role: 'assistant', tool_calls: [...] }
  { role: 'tool', content: resultado, tool_call_id: ... }
         │
         ▼
Chama LLM novamente com o contexto atualizado
(max 5 rounds de tool calls)
         │
         ▼
LLM formula resposta final para o usuario
```

> 💡 **Dica:** Tools sao executadas em paralelo via `Promise.allSettled`. Se uma tool falhar, as outras continuam e o LLM recebe o erro como texto para decidir como proceder.

### Activity Log

Toda execucao de tool e registrada:

```sql
INSERT INTO activity_log (user_id, event_type, description, metadata, created_at)
VALUES ($1, 'tool_call', $2, $3, NOW());
```

Isso permite auditoria completa de tudo que o agente fez. Visivel no widget de atividade do agente na dashboard principal.
