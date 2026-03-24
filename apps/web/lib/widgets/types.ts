import type { ModuleId } from '@hawk/shared';
import type { LucideIcon } from 'lucide-react';

export type WidgetSize = { w: number; h: number };

export type SystemModuleId = 'memory' | 'life-score';

export type WidgetDefinition = {
  id: string;
  moduleId: ModuleId | SystemModuleId;
  title: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
};

export type WidgetLayoutItem = {
  i: string; // widget instance id (can differ from definition id for duplicates)
  widgetId: string; // references WidgetDefinition.id
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DashboardLayout = {
  widgets: WidgetLayoutItem[];
};
