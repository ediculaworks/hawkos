# Módulo: Carreira

## O que Rastreia

O módulo de carreira rastreia sessões de trabalho por projeto/cliente, horas investidas, receita gerada e evolução profissional.

> 🧩 **Para leigos:** É como um timesheet inteligente. Cada vez que você termina de trabalhar, fala pro agente "trabalhei 3h na EdiculaWorks" e ele registra. No fim do mês, você tem um relatório de quanto tempo dedicou a cada projeto — útil para cobrar por hora, para entender onde seu tempo vai, e para perceber se está equilibrando seus projetos. É especialmente útil para quem trabalha em múltiplos projetos — freelancers, consultores, empreendedores — onde controlar tempo por contexto é essencial.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `workspaces` | Projetos, clientes, empresas (nome, tipo, taxa/hora, status) |
| `work_sessions` | Sessões de trabalho (workspace, início, fim, duração, tarefas realizadas) |

### Estrutura

```typescript
type Workspace = {
  id: string;
  user_id: string;
  name: string;           // "EdiculaWorks", "Projeto Atlas", "Consultoria HC"
  type: 'empresa' | 'freelance' | 'projeto' | 'estudo';
  hourly_rate?: number;   // para calcular receita por hora
  status: 'ativo' | 'pausado' | 'encerrado';
  color?: string;         // para identificação visual
  notes?: string;
};

type WorkSession = {
  id: string;
  workspace_id: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  tasks_completed: string[];  // lista do que foi feito
  notes?: string;
};
```

## Keywords que Ativam o Módulo

```
trabalho, empresa, emprego, projeto, horas, freelance
```

Exemplos:
- "trabalhei 3h na EdiculaWorks hoje"
- "fiz consultoria de 2h no HC"
- "passei 4h no projeto Atlas"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `log_work` | workspace_name ou id, duration_minutes, tasks?, notes? | Registrar sessão de trabalho |
| `find_workspace_by_name` | name | Buscar workspace por nome (fuzzy) |

## Comandos Comuns no Chat

```
"trabalhei 3h na EdiculaWorks, implementei o módulo de finanças"
→ find_workspace_by_name("EdiculaWorks")
→ log_work({ workspace: EdiculaWorks, duration: 180, tasks: ["módulo de finanças"] })

"fiz 2h de consultoria no Hospital das Clínicas"
→ log_work({ workspace: "HC", duration: 120, notes: "consultoria" })

"quantas horas trabalhei essa semana?"
→ Consulta work_sessions da semana com soma de duration_minutes

"qual projeto me deu mais receita esse mês?"
→ work_sessions × hourly_rate por workspace
```

## Contexto L0/L1/L2

### L0 (~40 tokens)
```
[career] Esta semana: 18h trabalhadas. Projetos: EdiculaWorks (12h), HC (6h).
```

### L1 (~350 tokens)
```
Workspaces ativos:
  - EdiculaWorks: 12h esta semana, R$X/h → R$Y semana
  - Projeto Atlas: pausado (última sessão há 5 dias)
  - HC Consultoria: 6h esta semana
Sessões recentes:
  - Sex 21/03: EdiculaWorks 3h — módulo de finanças
  - Qui 20/03: HC 2h — reunião de estratégia
Total mensal: 68h / ~120h meta mensal
```

### L2 (~500 tokens)
Ativado por: "relatório de horas", "quanto trabalhei em março"
```
Breakdown completo por workspace e semana
Comparação com meses anteriores
Receita calculada se hourly_rate definido
```

## Dashboard

A página `/dashboard/career` inclui:
- Workspaces ativos com horas da semana/mês
- Timeline de sessões de trabalho
- Gráfico de distribuição de tempo por projeto
- Receita calculada (se taxa/hora configurada)

## Integração com Objectives

Sessões de trabalho podem ser vinculadas a tarefas do módulo de objetivos, permitindo rastrear quanto tempo cada objetivo está consumindo.
