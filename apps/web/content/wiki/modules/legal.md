# Módulo: Jurídico (Legal)

## O que Rastreia

O módulo jurídico gerencia a vida legal e fiscal — entidades jurídicas (CNPJ, MEI, empresas), contratos ativos, e obrigações periódicas (DAS mensal, IRPF, declarações). O foco é não perder prazos que têm multa e ter visibilidade sobre obrigações fiscais.

> 🧩 **Para leigos:** DAS é o imposto mensal do Simples Nacional (para MEI e empresas do Simples). IRPF é o Imposto de Renda Pessoa Física, declarado anualmente. O módulo jurídico rastreia esses prazos e te avisa antes que você esqueça e tome multa.

> ⚠️ **Atenção:** O módulo jurídico é somente leitura via agente — contratos e entidades só podem ser criados/editados pelo dashboard, pois são dados sensíveis que merecem revisão cuidadosa antes de salvar.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `entities` | Entidades jurídicas (CNPJ, regime tributário, sócios, status) |
| `contracts` | Contratos (partes, objeto, valor, vigência, status) |
| `obligations` | Obrigações periódicas (tipo, vencimento, recorrência, status) |

### Estrutura

```typescript
type LegalEntity = {
  id: string;
  user_id: string;
  name: string;             // "EdiculaWorks Ltda"
  cnpj: string;
  type: 'ltda' | 'sa' | 'mei' | 'eireli' | 'associação';
  tax_regime: 'simples' | 'lucro_presumido' | 'lucro_real';
  status: 'ativa' | 'suspensa' | 'baixada';
  partners?: string[];
  registered_at?: string;
};

type Contract = {
  id: string;
  user_id: string;
  entity_id?: string;
  title: string;
  parties: string[];        // nomes das partes
  value?: number;
  start_date: string;
  end_date?: string;
  status: 'vigente' | 'encerrado' | 'em_negociação' | 'rescindido';
  document_url?: string;    // link para o documento no R2
  notes?: string;
};

type Obligation = {
  id: string;
  entity_id: string;
  type: 'DAS' | 'IRPF' | 'IRPJ' | 'declaração' | 'outro';
  description: string;
  due_date: string;
  recurrence: 'mensal' | 'trimestral' | 'anual' | 'único';
  amount?: number;
  status: 'pendente' | 'pago' | 'atrasado' | 'dispensado';
};
```

## Keywords que Ativam o Módulo

```
imposto, cnpj, das, irpf, contrato, prazo
```

Exemplos:
- "o DAS vence quando?"
- "tenho um contrato novo com o HC"
- "prazo do IRPF esse ano"
- "status da EdiculaWorks"

## Tools do Agente

O módulo jurídico não tem tools de escrita via agente — operações são feitas pelo dashboard (contratos e entidades são dados sensíveis que merecem revisão cuidadosa). O contexto do agente inclui os dados relevantes para perguntas e alertas.

## Comandos Comuns no Chat

```
"o DAS da EdiculaWorks vence quando?"
→ Consulta obligations com type: "DAS" para EdiculaWorks

"meu IRPF precisa ser declarado até quando?"
→ Consulta obligations com type: "IRPF"

"tenho contratos vencendo nos próximos 30 dias?"
→ Consulta contracts com end_date nos próximos 30 dias

"status do contrato com o HC?"
→ Consulta contracts com "HC" no nome das partes
```

## Contexto L0/L1/L2

### L0 (~40 tokens)
```
[legal] 1 CNPJ ativo (EdiculaWorks - Simples). 2 contratos vigentes. DAS vence em 8 dias.
```

### L1 (~400 tokens)
```
Entidades:
  - EdiculaWorks Ltda (CNPJ: XX.XXX.XXX/0001-XX, Simples Nacional, ativa)
Obrigações próximas:
  - DAS Fev/26: vence em 8 dias (R$350 estimado)
  - IRPF 2025: prazo 30/04/26 (não iniciado)
Contratos vigentes:
  - Hospital das Clínicas: consultoria técnica, até Dez/26, R$5.000/mês
  - Fornecedor AWS: SLA anual, até Jun/26
Contratos vencendo em 60 dias:
  - Locação escritório: vence 15/05/26 — renovar ou não?
```

### L2 (~600 tokens)
Ativado por: "histórico de obrigações", "relatório fiscal"
```
Histórico completo de pagamentos (DAS, impostos)
Contratos encerrados e histórico
Obrigações do ano fiscal completo
```

## Dashboard

A página `/dashboard/legal` inclui:
- **Legal Header**: CNPJs ativos, obrigações pendentes
- **Entities Summary**: cards de entidades jurídicas com status
- **Contracts List**: contratos com status, vigência e valor
- **Obligations List**: calendário de obrigações com status de pagamento

## Alertas Automáticos

A automação de alertas (08:00 diário) inclui:
- DAS e outros impostos com vencimento nos próximos 7 dias
- Contratos vencendo em 30 dias
- Obrigações atrasadas

## Integração com Outros Módulos

- **Finances**: pagamento de DAS e impostos vira transação no finances
- **Assets**: documentos de contratos ficam em assets/documents
- **Calendar**: vencimentos de obrigações viram eventos no calendário
