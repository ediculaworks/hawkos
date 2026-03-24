# Módulo: Moradia (Housing)

## O que Rastreia

O módulo de moradia gerencia a infraestrutura doméstica — imóveis (próprios ou alugados), contas mensais de moradia (aluguel, condomínio, água, luz, internet) e itens de manutenção. O objetivo é ter controle sobre custos fixos de moradia e não deixar manutenções esquecidas.

> 🧩 **Para leigos:** É o controle financeiro e operacional da sua casa. Você registra todas as contas mensais (aluguel, luz, internet) e o sistema avisa quando vence cada uma. Manutenções pendentes ficam numa lista por prioridade — da torneira vazando (urgente) até a parede que você quer pintar (baixa prioridade).

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `properties` | Imóveis (endereço, tipo, próprio/alugado, valor aluguel) |
| `bills` | Contas de moradia (tipo, valor, vencimento, status de pagamento) |
| `maintenance_items` | Itens de manutenção (descrição, prioridade, status, custo estimado) |

### Estrutura

```typescript
type Property = {
  id: string;
  user_id: string;
  name: string;             // "Apartamento SP", "Casa Campinas"
  address: string;
  type: 'apartamento' | 'casa' | 'sala_comercial' | 'outro';
  ownership: 'próprio' | 'alugado' | 'financiado';
  rent_amount?: number;     // se alugado
  rent_due_day?: number;    // dia do vencimento
  notes?: string;
};

type Bill = {
  id: string;
  property_id: string;
  name: string;             // "Aluguel", "Condomínio", "Água", "Luz", "Internet"
  amount: number;
  due_day: number;          // dia do mês
  status: 'pendente' | 'pago' | 'atrasado';
  paid_at?: string;
  notes?: string;
};

type MaintenanceItem = {
  id: string;
  property_id: string;
  description: string;      // "Trocar torneira da cozinha", "Pintar quarto"
  priority: 'baixa' | 'média' | 'alta' | 'urgente';
  status: 'pendente' | 'em_andamento' | 'concluído';
  estimated_cost?: number;
  actual_cost?: number;
  scheduled_date?: string;
  notes?: string;
};
```

## Keywords que Ativam o Módulo

```
aluguel, casa, conta de
```

Exemplos:
- "paguei o aluguel"
- "conta de luz chegou R$180"
- "precisa trocar a torneira da cozinha"
- "condomínio vence quando?"

## Comandos Comuns no Chat

```
"paguei o aluguel de março, R$2.200"
→ Atualiza bill "Aluguel" como pago + create_transaction em finances

"conta de luz chegou R$180"
→ Atualiza bill "Luz" com valor + status pendente

"a torneira da cozinha tá vazando"
→ Cria maintenance_item urgente

"o que precisa de manutenção?"
→ Lista maintenance_items pendentes por prioridade

"condomínio vence no dia 10, quanto é?"
→ Consulta bill "Condomínio" com due_day e amount
```

## Contexto L0/L1/L2

### L0 (~35 tokens)
```
[housing] Apt SP (alugado, R$2.200/mês). Contas: 3 pendentes. 1 manutenção urgente.
```

### L1 (~350 tokens)
```
Propriedades:
  - Apartamento SP: alugado R$2.200/mês, vence dia 5
Contas do mês:
  ✅ Aluguel R$2.200 (pago dia 3)
  ⏳ Condomínio R$450 (vence dia 10 — 3 dias)
  ⏳ Internet R$120 (vence dia 15)
  ✅ Água R$85 (pago)
  ⏳ Luz R$180 (vence dia 12 — chegou ontem)
Manutenções:
  🔴 URGENTE: Torneira cozinha vazando (pendente)
  🟡 MÉDIA: Pintura do banheiro (pendente, est. R$800)
```

### L2 (~500 tokens)
Ativado por: "histórico de contas", "gastos de moradia no mês"
```
Todas as contas do período com status de pagamento
Soma de gastos de moradia vs mês anterior
Histórico de manutenções realizadas e custos
```

## Dashboard

A página `/dashboard/housing` inclui:
- **Housing Header**: total mensal de moradia, status de pagamentos
- **Bills List**: contas com status de pagamento e vencimento
- **Maintenance List**: itens de manutenção por prioridade

## Integração com Outros Módulos

- **Finances**: pagamento de contas gera transações automáticas em finances
- **Calendar**: vencimentos de contas viram lembretes no calendário
- **Assets**: o imóvel em si (escritura, documentos) fica em assets
- **Alerts**: contas próximas do vencimento aparecem no alerta diário
