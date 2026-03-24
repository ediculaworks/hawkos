# Módulo Demands — Execução Multi-Agent

> 🧩 **Para leigos:** O módulo Demands é como um sistema de gestão de projetos inteligente. Em vez de você gerenciar cada passo manualmente, você diz o que quer alcançar ("criar um site") e o sistema quebra isso em tarefas menores, executa elas automaticamente e te mantém atualizado sobre o progresso.

## O que é

O módulo **Demands** (Demandas) é um sistema de execução multi-agent para tarefas de longa duração. Ele permite:

- Criar demandas de alto nível com múltiplos passos
- Executar passos sequencialmente ou em paralelo
- Acompanhar progresso em tempo real
- Pausar e resuming execuções
- Armazenar artefatos e logs de cada etapa

## Quando usar

- **Projetos grandes**: Tarefas que não podem ser feitas em uma única mensagem
- **Automação complexa**: Sequências de ações que precisam de verificação entre etapas
- **Execução prolongada**: Operações que levam horas ou dias
- **Colaboração humano-agent**: Quando você precisa interromper para dar input

## Tabelas

| Tabela | Descrição |
|--------|-----------|
| `demands` | Demandas principais (título, descrição, status, prioridade) |
| `demand_steps` | Passos individuais de cada demanda |
| `demand_logs` | Logs de execução (info, erros, ações do agent) |
| `demand_artifacts` | Arquivos e dados gerados durante execução |

## Status de Demanda

| Status | Significado |
|--------|-------------|
| `draft` | Rascunho — ainda está sendo definido |
| `triaging` | Em triagem — o sistema está analisando os passos necessários |
| `planned` | Planejado — passos definidos, pronto para executar |
| `running` | Em execução |
| `paused` | Pausado — pode ser retomado |
| `completed` | Concluído com sucesso |
| `failed` | Falhou — error irrecuperável |
| `cancelled` | Cancelado pelo usuário |

## Como funciona

### 1. Criar Demanda

Você pode criar uma demanda via agente:

```
"cria demanda: migrar dados do Notion para o banco"
"nova demanda: revisar todos os contratos da empresa"
```

O sistema:
- Analisa a solicitação
- Quebra em passos menores
- Define dependências entre passos
- Pede confirmação ou ajuste

### 2. Execução

Os passos podem executar de diferentes formas:
- **Sequencial**: Um após o outro
- **Parallel**: Vários ao mesmo tempo
- **Conditional**: tergantung de condição
- **Checkpoint**: Pausa para aprovação humana

### 3. Acompanhamento

Via dashboard `/dashboard/demands`:
- Ver todas as demandas ativas
- Acompanhar progresso de cada passo
- Ver logs em tempo real
- Intervir manualmente se necessário

## Via Agente

| O que dizer | O que acontece |
|-------------|---------------|
| "cria demanda: [descrição]" | Nova demanda em modo triaging |
| "mostra demandas ativas" | Lista demandas com status running/paused |
| "pausa demanda #123" | Pausa a execução |
| "retoma demanda #123" | Retoma execução |
| "cancela demanda #123" | Cancela a demanda |

## Dashboard

A página `/dashboard/demands` inclui:
- Lista de todas as demandas
- Filtros por status e prioridade
- Visualização de steps com progresso
- Logs em tempo real
- Ação para pausar/retomar/cancelar

> 💡 **Dica:** Use demandas para tarefas que você não consegue fazer em uma única conversa. O agente vai te manter informado sobre o progresso.