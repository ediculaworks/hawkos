# Módulo: Entretenimento

## O que Rastreia

O módulo de entretenimento rastreia o que você consome e pratica no tempo de lazer — filmes, séries, músicas, livros, hobbies (skate, fotografia, etc.). Serve tanto como lista de coisas para assistir/fazer quanto como registro do que já foi consumido, com avaliações e notas.

> 🧩 **Para leigos:** É sua watchlist, readlist e lista de hobbies em um lugar só. Você fala "quero assistir Dune 2" e ele adiciona à lista. Quando assistir, fala "assisti Dune 2, nota 9" e ele registra. Daqui a 6 meses, você pode perguntar "o que eu assisti esse ano" e ter uma lista completa com avaliações.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `media_items` | Filmes, séries, músicas, livros, podcasts (nome, tipo, status, avaliação) |
| `hobbies` | Hobbies e atividades de lazer (sessões, progresso, notas) |

### Estrutura

```typescript
type MediaItem = {
  id: string;
  user_id: string;
  title: string;
  type: 'filme' | 'série' | 'livro' | 'música' | 'podcast' | 'jogo';
  status: 'quero_ver' | 'assistindo' | 'assistido' | 'abandonado';
  rating?: number;          // 1-10
  platform?: string;        // Netflix, Spotify, Kindle
  notes?: string;           // impressões, favoritos, etc.
  started_at?: string;
  finished_at?: string;
  genre?: string;
  tags?: string[];
};

type Hobby = {
  id: string;
  user_id: string;
  name: string;             // "Skate", "Fotografia", "Xadrez"
  sessions: HobbySession[];
};
```

## Keywords que Ativam o Módulo

```
filme, série, música, skate, lazer
```

Exemplos:
- "assisti Oppenheimer ontem, 9/10"
- "add Dune na lista para ver"
- "skate hoje, 1h"
- "terminei de ler Atomic Habits"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `create_media` | title, type, status, rating?, platform?, notes? | Adicionar mídia (lista ou já consumida) |

## Comandos Comuns no Chat

```
"assisti Oppenheimer, nota 9/10, incrível"
→ create_media({ title: "Oppenheimer", type: "filme", status: "assistido", rating: 9, notes: "incrível" })

"add Dune 2 na lista de filmes para ver"
→ create_media({ title: "Dune: Parte 2", type: "filme", status: "quero_ver" })

"terminei Atomic Habits, nota 8"
→ create_media({ title: "Atomic Habits", type: "livro", status: "assistido", rating: 8 })

"estou no ep 5 de The Bear"
→ create_media({ title: "The Bear", type: "série", status: "assistindo", notes: "ep 5" })

"quais filmes quero assistir?"
→ Consulta media_items com type: "filme" e status: "quero_ver"
```

## Contexto L0/L1/L2

### L0 (~30 tokens)
```
[entertainment] 8 filmes na lista. Assistindo: The Bear (ep 5). Lendo: nada no momento.
```

### L1 (~300 tokens)
```
Assistindo agora:
  - The Bear (série, ep 5/10)
  - Nada no cinema planejado
Lista de filmes (top 3 prioridade):
  - Dune 2
  - Oppenheimer (terminei recentemente — 9/10)
  - Past Lives
Lendo: Nada (último: Atomic Habits — 8/10, terminado há 2 semanas)
Skate: última sessão há 5 dias (1h)
```

### L2 (~400 tokens)
Ativado por: "histórico de filmes", "o que assisti esse ano"
```
Lista completa com avaliações e datas
Estatísticas: filmes/mês, rating médio, gêneros preferidos
```

## Dashboard

A página `/dashboard/entertainment` inclui:
- **Entertainment Header**: mídias em andamento, lista de espera
- **Media List**: lista com filtros por tipo e status, ratings visuais
- **Hobbies List**: sessões de hobbies com frequência e notas

## Integração com Outros Módulos

- **Memory**: livros consumidos podem gerar memórias no sistema de memória
- **Routine**: hobbies como skate podem ser cadastrados como hábitos em routine
