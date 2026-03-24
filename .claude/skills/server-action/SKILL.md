---
name: server-action
description: Create Next.js Server Actions following Hawk OS conventions
user-invocable: false
---

# Server Action Skill

## Convenções
- Path: apps/web/lib/actions/<módulo>.ts
- Sempre com 'use server' no topo
- Importar Supabase client de @hawk/db
- Retornar dados tipados do módulo
- Tratar erros com try/catch
- Nunca SELECT * — listar campos explicitamente
- Paginação com limit + offset

## Template

```typescript
'use server';

import { db } from '@hawk/db';
import type { ModuleType } from '@hawk/module-name';

export async function fetchItems(limit = 20, offset = 0): Promise<ModuleType[]> {
  const { data, error } = await db
    .from('table_name')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data ?? [];
}

export async function createItem(input: CreateInput): Promise<ModuleType> {
  const { data, error } = await db
    .from('table_name')
    .insert(input)
    .select('id, name, created_at')
    .single();

  if (error) throw error;
  return data;
}
```
