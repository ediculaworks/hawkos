'use client';

import { fetchUrgentObligations } from '@/lib/actions/legal';
import { fetchOverdueTasks } from '@/lib/actions/objectives';
import { fetchOverdueContacts } from '@/lib/actions/people';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetches badge counts for sidebar modules.
 * Only queries for modules where badges make sense (actionable items).
 * Uses long staleTime to avoid excessive API calls.
 */
export function useSidebarBadges(): Record<string, number> {
  const { data: overdueTasks } = useQuery({
    queryKey: ['sidebar-badge', 'objectives'],
    queryFn: fetchOverdueTasks,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: overdueContacts } = useQuery({
    queryKey: ['sidebar-badge', 'people'],
    queryFn: fetchOverdueContacts,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: urgentObligations } = useQuery({
    queryKey: ['sidebar-badge', 'legal'],
    queryFn: fetchUrgentObligations,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const badges: Record<string, number> = {};

  if (overdueTasks?.length) badges.objectives = overdueTasks.length;
  if (overdueContacts?.length) badges.people = overdueContacts.length;
  if (urgentObligations?.length) badges.legal = urgentObligations.length;

  return badges;
}
