---
name: widget-creation
description: Create dashboard widgets following Hawk OS grid system conventions
user-invocable: false
---

# Widget Creation Skill

## Convenções
- Path: apps/web/components/widgets/<módulo>/<nome>.tsx
- Registrar em apps/web/lib/widgets/registry.ts
- Componente client ('use client') com dados via Server Actions
- Skeleton loading state obrigatório
- Error boundary wrapper

## Grid System
- 12 colunas
- Breakpoints: lg (1200px), md (900px), sm (600px)
- Row height: 72px, gap: 16px
- defaultSize e minSize obrigatórios

## Template

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWidgetData } from '@/lib/actions/module';

export default function WidgetName() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWidgetData()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-full w-full" />;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Widget Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Widget content here */}
      </CardContent>
    </Card>
  );
}
```

## Registry Entry

```typescript
{
  id: 'module-widget-name',
  moduleId: 'module',
  title: 'Título',
  icon: LucideIcon,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  component: lazy(() => import('@/components/widgets/module/WidgetName')),
}
```
