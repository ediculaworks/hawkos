# Módulo: Patrimônio (Assets)

## O que Rastreia

O módulo de patrimônio rastreia bens físicos e documentos importantes. Inventário de bens (eletrônicos, veículos, imóveis), documentos pessoais (RG, passaporte, escrituras, apólices de seguro) e acervo digitalizado. O foco é saber o que você tem, onde está, e acessar documentos quando precisar.

> 🧩 **Para leigos:** É um inventário digital da sua vida. Em vez de lembrar onde está o contrato do apartamento ou quando vence o passaporte, você registra aqui e pergunta pro agente quando precisar. O sistema também guarda documentos digitalizados e avisa quando algum está prestes a vencer.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `assets` | Bens patrimoniais (nome, tipo, valor, data de compra, localização) |
| `documents` | Documentos digitalizados (nome, categoria, arquivo, tags) |

### Estrutura

```typescript
type Asset = {
  id: string;
  user_id: string;
  name: string;               // "MacBook Pro 14"", "Honda Civic 2022"
  type: 'eletrônico' | 'veículo' | 'imóvel' | 'equipamento' | 'outro';
  purchase_value?: number;    // valor de compra em R$
  current_value?: number;     // valor atual estimado
  purchase_date?: string;
  location?: string;          // "escritório", "casa", "guardado"
  serial_number?: string;
  warranty_until?: string;
  notes?: string;
};

type Document = {
  id: string;
  user_id: string;
  name: string;               // "RG", "Passaporte", "Escritura apt"
  category: 'pessoal' | 'imóvel' | 'veículo' | 'empresa' | 'seguro' | 'outro';
  file_url?: string;          // URL no R2/Storage
  tags?: string[];
  expires_at?: string;        // para documentos com validade
  notes?: string;
};
```

## Keywords que Ativam o Módulo

```
bem, documento, patrimônio
```

Exemplos:
- "busca o contrato do apartamento"
- "meu patrimônio total"
- "adiciona o MacBook ao inventário"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `search_documents` | query | Busca semântica nos documentos |

## Comandos Comuns no Chat

```
"busca o contrato do apartamento"
→ search_documents({ query: "contrato apartamento" })

"qual o valor do meu patrimônio total?"
→ Soma de current_value de todos os assets

"meu passaporte vence quando?"
→ search_documents({ query: "passaporte" }) → exibe expires_at
```

## Contexto L0/L1/L2

### L0 (~30 tokens)
```
[assets] 12 bens cadastrados. Valor patrimonial: R$85.000. 24 documentos.
```

### L1 (~300 tokens)
```
Principais bens:
  - MacBook Pro 14" (R$18.000, escritório)
  - Honda Civic 2022 (R$85.000 mercado)
  - Apartamento SP (valor estimado R$450.000)
Documentos com vencimento próximo:
  - Passaporte: vence em 8 meses (Nov/26)
  - CNH: vence em 14 meses (Mai/27)
```

### L2 (~600 tokens)
Ativado por: "inventário completo", "todos os documentos"
```
Lista completa de bens com valores e localização
Lista completa de documentos com status de validade
```

## Dashboard

A página `/dashboard/assets` inclui:
- **Assets Header**: valor patrimonial total, contagem de bens
- **Assets List**: inventário com tipo, valor, localização
- **Documents List**: acervo de documentos com filtros por categoria
- Alertas de documentos com vencimento próximo

## Armazenamento de Arquivos

Documentos físicos digitalizados são armazenados no Cloudflare R2:
```
R2_BUCKET=backups (também usado para documentos)
Pasta: documents/{user_id}/{document_id}
```

## Integração com Outros Módulos

- **Legal**: documentos de entidades jurídicas (CNPJ, contratos) são compartilhados entre assets e legal
- **Housing**: escrituras e documentos de imóveis estão em assets, enquanto contas e manutenções estão em housing
