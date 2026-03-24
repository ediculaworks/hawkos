# Módulo: Objetivos

## O que Rastreia

O módulo de objetivos gerencia metas de médio/longo prazo e as tarefas que as compõem.

> 🧩 **Para leigos:** Pense em dois níveis: Objetivos são os grandes sonhos ("lançar o produto até junho", "emagrecer 5kg"). Tarefas são os passos concretos para chegar lá ("implementar módulo de memória", "ir à academia 3x essa semana"). O agente ajuda a criar ambos e rastreia o progresso automaticamente. Segue uma hierarquia simples: **Objetivos** contêm **Tarefas**. Objetivos têm prazo e área de vida. Tarefas têm status, prioridade e podem ter deadline.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `goals` | Objetivos (título, descrição, área, prazo, status, progresso) |
| `tasks` | Tarefas (título, objetivo vinculado, prioridade, status, deadline) |

### Estrutura

```typescript
type Goal = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  area: 'saúde' | 'finanças' | 'carreira' | 'relacionamentos' | 'pessoal';
  deadline?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  progress: number;   // 0-100, calculado das tarefas ou manual
};

type Task = {
  id: string;
  goal_id?: string;
  user_id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  deadline?: string;
  tags?: string[];
};
```

## Keywords que Ativam o Módulo

```
objetivo, meta, tarefa, progresso
```

Exemplos:
- "adiciona tarefa: revisar relatório"
- "meu objetivo de perder 5kg"
- "qual o progresso dos meus objetivos?"
- "tarefas para essa semana"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `create_objective` | title, area, deadline?, description? | Criar novo objetivo |
| `create_task` | title, goal_id?, priority?, deadline? | Criar tarefa (avulsa ou vinculada) |

## Comandos Comuns no Chat

```
"adiciona objetivo: lançar o LifeOS até junho"
→ create_objective({ title: "Lançar LifeOS", area: "carreira", deadline: "2026-06-30" })

"cria tarefa urgente: revisar o contrato do HC"
→ create_task({ title: "Revisar contrato HC", priority: "urgent", deadline: "amanhã" })

"tarefa: estudar pgvector, prioridade alta, para o objetivo LifeOS"
→ create_task({ title: "Estudar pgvector", priority: "high", goal: "LifeOS" })

"quais minhas tarefas para hoje?"
→ Consulta tasks com deadline = hoje ou status = in_progress

"progresso dos objetivos?"
→ get_objectives_summary()
```

## Contexto L0/L1/L2

### L0 (~40 tokens)
```
[objectives] 2 objetivos ativos. 5 tarefas pendentes (2 urgentes).
```

### L1 (~400 tokens)
```
Objetivos ativos:
  - Lançar LifeOS (carreira): 65% completo, deadline Jun/26
  - Emagrecer 5kg (saúde): 40% completo, sem deadline
Tarefas desta semana:
  - URGENTE: Revisar contrato HC (vence amanhã)
  - ALTA: Implementar módulo de memória
  - MÉDIA: Estudar pgvector
  - MÉDIA: Reunião com João sobre Atlas
  - BAIXA: Organizar pastas do drive
```

### L2 (~500 tokens)
Ativado por: "histórico de objetivos", "tarefas do mês"
```
Todos os objetivos com histórico de status
Tarefas concluídas e canceladas do período
Taxa de conclusão por área
```

## Dashboard

A página `/dashboard/objectives` inclui:

- **Objectives Header**: total de objetivos ativos, progresso médio
- **Inline Goal Form**: adicionar objetivo rapidamente sem modal
- **Inline Task Form**: adicionar tarefa rapidamente
- **Task Row**: cada tarefa com status toggle, prioridade, deadline
- **Progresso visual** por objetivo com barra de progresso

## Integração com Outros Módulos

- **Career**: sessões de trabalho podem ser vinculadas a tarefas/objetivos
- **Calendar**: deadlines de tarefas/objetivos aparecem no calendário
- **Health**: objetivos de saúde (emagrecer, treinar X vezes) se conectam ao health tracking
