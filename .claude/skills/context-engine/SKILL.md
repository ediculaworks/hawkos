---
name: context-engine
description: Implement L0/L1/L2 context loading for Hawk OS modules
user-invocable: false
---

# Context Engine Skill

## Conceito

Cada módulo exporta 3 funções de contexto que alimentam o agent:
- `loadL0()` — carregado SEMPRE (~100 tokens)
- `loadL1()` — carregado quando módulo é relevante (~2k tokens)
- `loadL2()` — carregado sob demanda para queries granulares

## Implementação Típica

```typescript
// packages/modules/<name>/context.ts
import { db } from '@hawk/db';

export async function loadL0(): Promise<string> {
  const summary = await db.from('<main_table>').select('id').limit(1).single();
  return `<name>: X items cadastrados. Último: Y.`;
}

export async function loadL1(profileId: string): Promise<string> {
  const items = await db.from('<main_table>')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!items.data?.length) return `<name>: sem dados.`;
  
  return `<name>:\n${items.data.map(i => `• ${i.name} (${i.status})`).join('\n')}`;
}

export async function loadL2(profileId: string, query: string): Promise<string> {
  // Busca granular via FTS ou filtros específicos
  const results = await db.from('<main_table>')
    .select('*')
    .eq('profile_id', profileId)
    .ilike('name', `%${query}%`);
  
  return results.data?.map(r => `• ${r.name}: ${r.description}`).join('\n') ?? '';
}
```

## Cache L0

O context engine já faz cache de L0 por 5 minutos em memória. Não precisa de cache adicional.

## Módulos Existentes

Ver `packages/modules/` para exemplos reais de cada módulo.
