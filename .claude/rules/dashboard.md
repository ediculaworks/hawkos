# Dashboard — Padrões de Desenvolvimento

## Stack

- Next.js 15, React 19, Tailwind CSS v4, shadcn/ui
- App Router com Server Components
- Server Actions em `apps/web/lib/actions/`

## Estrutura

```
apps/web/
├── app/dashboard/        → Páginas por módulo
├── components/
│   ├── dashboard/        → DashboardGrid, layout
│   ├── widgets/          → Widgets do grid por módulo
│   ├── shell/            → Sidebar, TopBar
│   └── ui/               → Primitivos shadcn
├── lib/
│   ├── actions/          → Server Actions por módulo
│   ├── stores/           → Zustand (layout, UI)
│   └── widgets/registry.ts → Widget definitions
```

## Criando um Widget

1. Criar componente em `components/widgets/<module>/`
2. Registrar em `lib/widgets/registry.ts`:
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
3. Widget recebe dados via Server Actions ou client-side fetch

## Grid System

- `react-grid-layout` com 12 colunas
- Breakpoints: lg (1200px), md (900px), sm (600px)
- Row height: 72px, gap: 16px
- Layout persistido via Zustand + localStorage

## Criando uma Página de Módulo

1. Criar `app/dashboard/<module>/page.tsx`
2. Server Component que carrega dados iniciais
3. Componentes client para interatividade
4. Server Actions para mutações
