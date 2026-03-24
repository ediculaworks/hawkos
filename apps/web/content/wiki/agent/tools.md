# Tools do Agente

## O que são Tools

Tools são funções que o LLM pode chamar para ler ou escrever dados. Quando você diz "registra que fui na academia", o LLM não "escreve" nada por conta própria — ele gera uma chamada de tool (`log_habit` ou `log_workout`) e o sistema executa a operação no banco.

Isso garante que:
1. Dados estruturados vão para as tabelas corretas
2. Operações são validadas antes de executar
3. O LLM não pode fazer nada que o código não permite explicitamente
4. Toda ação fica registrada no `activity_log`

> 🧩 **Para leigos:** Imagine que o agente é um gerente de escritório super inteligente, mas ele não tem acesso direto aos arquivos. Para arquivar algo, ele precisa pedir pra uma secretária específica (a "tool"). Isso garante que nada é guardado no lugar errado e tudo fica registrado.

## Tool Routing Dinâmico

O Hawk OS tem 30+ tools, mas enviar todas a cada chamada LLM seria desperdício. O sistema filtra dinamicamente:

```typescript
// Cada tool declara a quais módulos pertence
const tools = {
  create_transaction: {
    name: 'create_transaction',
    modules: ['finances'],  // ← só carregada quando finances é detectado
    description: 'Registra uma transação financeira',
    parameters: { ... },
    handler: async (args) => { ... },
  },

  save_memory: {
    name: 'save_memory',
    modules: [],  // ← [] = universal, sempre carregada
    description: 'Salva uma memória permanente',
    parameters: { ... },
    handler: async (args) => { ... },
  },
};

// Filtragem na hora de chamar o LLM
function getToolsForModules(
  detectedModules: ModuleId[],
  agentAllowedModules: ModuleId[] | null
): Tool[] {
  return Object.values(tools).filter(tool => {
    // Universal tools: sempre inclui
    if (tool.modules.length === 0) return true;

    // Verifica se o módulo foi detectado na mensagem
    const isDetected = tool.modules.some(m => detectedModules.includes(m));

    // Verifica se o agente tem permissão (null = todos)
    const isAllowed = agentAllowedModules === null ||
      tool.modules.some(m => agentAllowedModules.includes(m));

    return isDetected && isAllowed;
  });
}
```

**Resultado prático**: Uma mensagem sobre finanças carrega ~8 tools (finances + universais). Uma mensagem sobre agenda carrega ~5 tools. Uma mensagem genérica carrega apenas as universais (2 tools).

> 💡 **Dica:** Se o agente não encontrar uma tool que precisa (ex: você fala de treino mas o agente não carregou tools de health), você pode dizer "use as tools de saúde" e o sistema usa `request_more_tools` para carregar o módulo correto.

## Tools Universais

Sempre disponíveis, independente do módulo ou agente:

### `save_memory`

Salva uma memória permanente no banco com embedding vetorial.

```typescript
save_memory({
  type: 'preference' | 'profile' | 'entity' | 'event' | 'case' | 'pattern',
  content: string,       // o conteúdo da memória
  importance: 1 | 2 | 3 | 4 | 5,  // 5 = mais importante
  module?: string,       // módulo relacionado (para half-life)
})
```

### `request_more_tools`

Pede ao sistema que carregue tools de módulos adicionais. Útil quando a mensagem não ativou o módulo correto via keywords.

```typescript
request_more_tools({
  modules: ['finances', 'career'],  // módulos a carregar
  reason: string,                    // por que precisa
})
```

Após executar, o pipeline recarrega as tools e chama o LLM novamente.

## Tools por Módulo

### Finanças (`finances`)

| Tool | O que faz |
|------|-----------|
| `create_transaction` | Registra receita ou despesa com categoria, conta, data |
| `get_financial_summary` | Saldo total, gastos do mês, orçamento vs real |
| `get_budget_vs_actual` | Comparação por categoria no período |
| `get_categories` | Lista categorias disponíveis para classificação |
| `get_accounts` | Lista contas com saldos atuais |
| `get_portfolio_positions` | Posições de investimento |

### Saúde (`health`)

| Tool | O que faz |
|------|-----------|
| `log_workout` | Cria sessão de treino (tipo, duração, notas) |
| `add_workout_set` | Adiciona série a um treino (exercício, peso, reps) |
| `log_sleep` | Registra sono (início, fim, qualidade) |
| `log_weight` | Registra peso corporal |
| `get_exercise_progress` | Histórico de progresso num exercício específico |
| `estimate_1rm` | Calcula 1RM estimado baseado em série registrada |

### Memória / Onboarding (`memory`)

| Tool | O que faz |
|------|-----------|
| `get_next_question` | Próxima pergunta do fluxo de onboarding |
| `mark_question_answered` | Marca pergunta como respondida |
| `save_memory` | Salva memória no sistema de memória do agente |

### Objetivos (`objectives`)

| Tool | O que faz |
|------|-----------|
| `create_objective` | Cria meta/objetivo com prazo e área |
| `create_task` | Cria tarefa vinculada a um objetivo |

### Pessoas (`people`)

| Tool | O que faz |
|------|-----------|
| `create_person` | Adiciona pessoa ao CRM |
| `find_person_by_name` | Busca pessoa por nome (fuzzy) |
| `log_interaction` | Registra interação com pessoa (ligação, mensagem, encontro) |

### Rotina (`routine`)

| Tool | O que faz |
|------|-----------|
| `create_habit` | Cria novo hábito com frequência e meta |
| `find_habit_by_name` | Busca hábito por nome (fuzzy) |
| `log_habit` | Marca hábito como feito (com notas opcionais) |
| `get_habits_at_risk` | Lista hábitos com streak em risco de quebrar |

### Agenda (`calendar`)

| Tool | O que faz |
|------|-----------|
| `create_event` | Cria evento com título, data, duração, participantes |
| `find_free_slots` | Encontra slots livres num período |

### Carreira (`career`)

| Tool | O que faz |
|------|-----------|
| `log_work` | Registra sessão de trabalho (workspace, duração, tarefas) |
| `find_workspace_by_name` | Busca workspace/projeto por nome |

### Entretenimento (`entertainment`)

| Tool | O que faz |
|------|-----------|
| `create_media` | Adiciona filme, série, música, livro à lista |

### Patrimônio (`assets`)

| Tool | O que faz |
|------|-----------|
| `search_documents` | Busca documentos no acervo |

## Criando uma Nova Tool

Para adicionar uma tool ao sistema:

```typescript
// apps/agent/src/tools.ts

const my_new_tool: Tool = {
  name: 'my_new_tool',
  modules: ['finances'],  // ou [] para universal
  description: 'Descrição clara do que a tool faz e quando usar',
  parameters: {
    type: 'object',
    properties: {
      amount: {
        type: 'number',
        description: 'Valor em reais',
      },
      category: {
        type: 'string',
        description: 'Categoria da transação',
        enum: ['alimentacao', 'transporte', 'lazer'],
      },
    },
    required: ['amount'],
  },
  handler: async (args: { amount: number; category?: string }) => {
    // Chamar queries do módulo correspondente
    const result = await createTransaction({
      amount: args.amount,
      category: args.category,
      userId: getCurrentUserId(),
    });

    // Retornar string descritiva (vai para o contexto do LLM)
    return `Transação de R$${args.amount} registrada. ID: ${result.id}`;
  },
};

// Adicionar ao objeto tools
export const tools = {
  // ... tools existentes
  my_new_tool,
};
```

**Checklist para nova tool:**
- [ ] `name` único e descritivo (snake_case)
- [ ] `modules` correto (ou `[]` para universal)
- [ ] `description` clara — o LLM usa isso para decidir quando chamar
- [ ] `parameters` bem tipados com descriptions
- [ ] `handler` retorna string descritiva do resultado
- [ ] Usa queries do módulo, não acessa banco diretamente
- [ ] Erros são capturados e retornados como string de erro

> ⚠️ **Atenção:** A `description` da tool é crítica. É o que o LLM lê para decidir se deve chamar aquela tool ou não. Uma description vaga ou confusa faz o LLM escolher a tool errada ou não chamar quando deveria.

## Fluxo de Execução das Tools

```
LLM retorna tool_calls
         │
         ▼
Promise.all([executeTool(tc) for tc in tool_calls])
         │
         ├─ Valida parâmetros contra schema
         ├─ Chama handler(args)
         ├─ Loga no activity_log
         └─ Retorna resultado como string
         │
         ▼
Adiciona ao histórico de mensagens:
  { role: 'assistant', tool_calls: [...] }
  { role: 'tool', content: resultado, tool_call_id: ... }
         │
         ▼
Chama LLM novamente com o contexto atualizado
         │
         ▼
LLM formula resposta final para o usuário
```

### Activity Log

Toda execução de tool é registrada:

```sql
INSERT INTO activity_log (user_id, tool_name, args, result, duration_ms, created_at)
VALUES ($1, $2, $3, $4, $5, NOW());
```

Isso permite auditoria completa de tudo que o agente fez. Visível no widget de atividade do agente na dashboard principal.
