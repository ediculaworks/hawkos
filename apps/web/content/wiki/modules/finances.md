# Módulo: Finanças

## O que Rastreia

O módulo de finanças é o coração financeiro do Hawk OS. Rastreia receitas, despesas, saldos de contas, orçamento por categoria, transações recorrentes e posições de investimento. O objetivo é ter uma visão clara e atualizada da situação financeira sem precisar abrir o banco ou uma planilha.

> 🧩 **Para leigos:** É como ter um contador pessoal que você alimenta por mensagem. Você fala "gastei R$50 no mercado" e ele anota automaticamente na categoria certa, deduz do saldo da conta certa e atualiza seu orçamento mensal. No fim do mês, você tem um relatório completo sem ter feito nenhuma planilha.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `accounts` | Contas bancárias, carteiras, corretoras (nome, tipo, saldo) |
| `categories` | Categorias de gasto/receita com orçamento mensal |
| `transactions` | Transações individuais (valor, data, categoria, conta, notas) |
| `recurring_transactions` | Transações recorrentes (assinaturas, salário, aluguel) |

### Estrutura de uma Transação

```typescript
type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string;
  amount: number;           // positivo = receita, negativo = despesa
  description: string;
  date: string;             // ISO date
  type: 'income' | 'expense' | 'transfer';
  tags?: string[];
  notes?: string;
  created_at: string;
};
```

## Keywords que Ativam o Módulo

```
gasto, receita, dinheiro, saldo, dívida, pagar, comprar, custo, r$
```

Exemplos de mensagens que ativam finanças:
- "gastei R$50 no mercado"
- "recebi meu salário hoje"
- "quanto tenho no Nubank?"
- "paguei a fatura do cartão"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `create_transaction` | amount, description, category, account, date | Registrar qualquer gasto ou receita |
| `get_financial_summary` | period? | Visão geral do mês atual |
| `get_budget_vs_actual` | period, category? | Comparar orçado vs gasto |
| `get_categories` | — | Listar categorias disponíveis |
| `get_accounts` | — | Saldos de todas as contas |
| `get_portfolio_positions` | — | Posições de investimento |

## Comandos Comuns no Chat

```
"gastei R$120 no supermercado ontem"
→ create_transaction({ amount: -120, description: "Supermercado", category: "alimentação", date: "ontem" })

"recebi R$5000 de salário"
→ create_transaction({ amount: 5000, description: "Salário", category: "renda", type: "income" })

"quanto gastei esse mês?"
→ get_financial_summary({ period: "current_month" })

"como tá o orçamento de alimentação?"
→ get_budget_vs_actual({ period: "current_month", category: "alimentação" })

"qual o saldo total?"
→ get_accounts() → soma todos os saldos

"quanto tenho investido?"
→ get_portfolio_positions()
```

## Contexto L0/L1/L2

### L0 (sempre carregado, ~50 tokens)
```
[finances] Saldo total: R$12.340. Gasto mensal: R$3.200/R$4.000 orçado.
```

### L1 (quando finanças é detectado, ~400 tokens)
```
Contas: Nubank (R$8.200), Inter (R$4.140)
Últimas transações:
  - Supermercado R$340 (20/03)
  - Posto R$150 (18/03)
  - Restaurante R$85 (17/03)
Categorias mais gastas este mês: Alimentação 35%, Transporte 18%, Lazer 12%
Transações recorrentes: Netflix R$55 (dia 15), Aluguel R$2.200 (dia 5)
```

### L2 (quando query específica detectada, ~800 tokens)
Ativado por: "quanto gastei", "histórico", "relatório", datas específicas
```
Transações detalhadas do período solicitado com:
- Todas as transações em ordem cronológica
- Subtotais por categoria
- Comparação com período anterior
- Variações percentuais
```

## Dashboard

A página `/dashboard/finances` inclui:

- **Header**: saldo total, gasto vs orçamento do mês (barra de progresso)
- **Account Manager**: cards de contas com saldo atual, botão para adicionar conta
- **Transaction Feed**: lista de transações recentes com filtros por categoria/período
- **Quick Add Transaction**: formulário rápido para registrar gasto sem usar o agente
- **Category Chart**: gráfico de pizza por categoria (Recharts)
- **Recent Transactions Widget**: widget para o grid principal do dashboard

## Transações Recorrentes

O sistema detecta padrões de recorrência e pode:
1. Alertar quando uma recorrente não foi registrada no prazo esperado
2. Registrar automaticamente via automação diária (configurável)
3. Mostrar projeção de gastos do mês com base nas recorrentes

## Alertas Automáticos

> 💡 **Dica:** Configure um threshold de saldo mínimo no `.env` para receber alerta quando alguma conta ficar baixa. Útil para evitar surpresas com cobranças automáticas.

A automação `alerts.ts` (08:00 diário) verifica:
- Orçamento ultrapassado em alguma categoria (>90% gasto)
- Transações recorrentes pendentes do dia
- Saldo abaixo de threshold configurado
