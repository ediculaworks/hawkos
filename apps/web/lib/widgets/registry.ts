import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Brain,
  Calendar,
  CheckSquare,
  DollarSign,
  Heart,
  Home,
  ListChecks,
  MessageSquare,
  Rocket,
  Target,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { WidgetDefinition } from './types';

type WidgetEntry = WidgetDefinition & {
  component: () => Promise<{ default: ComponentType }>;
};

export const WIDGET_REGISTRY: Record<string, WidgetEntry> = {
  'finances-summary': {
    id: 'finances-summary',
    moduleId: 'finances',
    title: 'Finanças',
    icon: Wallet,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/finances/summary'),
  },
  'finances-transactions': {
    id: 'finances-transactions',
    moduleId: 'finances',
    title: 'Transações',
    icon: ArrowUpDown,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/finances/recent-transactions'),
  },
  'finances-categories': {
    id: 'finances-categories',
    moduleId: 'finances',
    title: 'Categorias',
    icon: BarChart3,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    component: () => import('@/components/widgets/finances/category-chart'),
  },
  'routine-habits': {
    id: 'routine-habits',
    moduleId: 'routine',
    title: 'Hábitos',
    icon: CheckSquare,
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    component: () => import('@/components/widgets/routine/habits-today'),
  },
  'routine-streaks': {
    id: 'routine-streaks',
    moduleId: 'routine',
    title: 'Streaks',
    icon: Zap,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 5 },
    component: () => import('@/components/widgets/routine/streaks'),
  },
  'objectives-goals': {
    id: 'objectives-goals',
    moduleId: 'objectives',
    title: 'Metas',
    icon: Target,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/objectives/goals-progress'),
  },
  'objectives-tasks': {
    id: 'objectives-tasks',
    moduleId: 'objectives',
    title: 'Tarefas',
    icon: ListChecks,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    component: () => import('@/components/widgets/objectives/active-tasks'),
  },
  'memory-stats': {
    id: 'memory-stats',
    moduleId: 'memory',
    title: 'Memória',
    icon: Brain,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 5 },
    component: () => import('@/components/widgets/memory/memory-stats'),
  },
  'life-score': {
    id: 'life-score',
    moduleId: 'life-score',
    title: 'Life Score',
    icon: Activity,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    component: () => import('@/components/widgets/life-score/life-score'),
  },
  // Integration widgets
  'wellness-pulse': {
    id: 'wellness-pulse',
    moduleId: 'health',
    title: 'Bem-estar',
    icon: Heart,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    component: () => import('@/components/widgets/wellness/wellness-pulse'),
  },
  'next-contacts': {
    id: 'next-contacts',
    moduleId: 'people',
    title: 'Contatos',
    icon: Users,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/people/next-contacts'),
  },
  'people-dormant': {
    id: 'people-dormant',
    moduleId: 'people',
    title: 'Contatos Dormentes',
    icon: Users,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/people/dormant-contacts'),
  },
  'people-upcoming': {
    id: 'people-upcoming',
    moduleId: 'people',
    title: 'Esta Semana',
    icon: Calendar,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/people/upcoming-contacts'),
  },
  deadlines: {
    id: 'deadlines',
    moduleId: 'calendar',
    title: 'Deadlines',
    icon: Calendar,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/calendar/deadlines'),
  },
  'work-income': {
    id: 'work-income',
    moduleId: 'career',
    title: 'Trabalho',
    icon: DollarSign,
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 4 },
    maxSize: { w: 6, h: 7 },
    component: () => import('@/components/widgets/career/work-income'),
  },
  'housing-bills': {
    id: 'housing-bills',
    moduleId: 'housing',
    title: 'Contas',
    icon: Home,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    component: () => import('@/components/widgets/housing/bills'),
  },
  // Agent / System widgets
  'agent-status': {
    id: 'agent-status',
    moduleId: 'memory',
    title: 'Agent Status',
    icon: Rocket,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    component: () => import('@/components/widgets/agent/agent-status'),
  },
  'agent-sessions': {
    id: 'agent-sessions',
    moduleId: 'memory',
    title: 'Sessões',
    icon: MessageSquare,
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    maxSize: { w: 4, h: 6 },
    component: () => import('@/components/widgets/agent/agent-sessions'),
  },
  'agent-activity': {
    id: 'agent-activity',
    moduleId: 'memory',
    title: 'Atividade',
    icon: Activity,
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    component: () => import('@/components/widgets/agent/agent-activity'),
  },
};

export function getWidgetDef(widgetId: string): WidgetEntry | undefined {
  return WIDGET_REGISTRY[widgetId];
}

export function listWidgetsByModule(): Record<string, WidgetEntry[]> {
  const grouped: Record<string, WidgetEntry[]> = {};
  for (const entry of Object.values(WIDGET_REGISTRY)) {
    const key = entry.moduleId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  return grouped;
}
