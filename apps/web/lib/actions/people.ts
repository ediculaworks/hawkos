'use server';

import {
  createPerson,
  deletePerson,
  getDormantContacts,
  getNetworkStats,
  getPersonWithInteractions,
  listOverdueContacts,
  listPendingReminders,
  listPeople,
  listRecentInteractions,
  listUpcomingBirthdays,
  logInteraction,
  updatePerson,
} from '@hawk/module-people/queries';
import type {
  ContactReminder,
  CreatePersonInput,
  Interaction,
  InteractionChannel,
  InteractionSentiment,
  InteractionType,
  InteractionWithPerson,
  NetworkStats,
  Person,
  PersonWithLastInteraction,
  UpdatePersonInput,
} from '@hawk/module-people/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchPeople(limit = 50, offset = 0) {
  return withTenant(async () => listPeople(limit, offset));
}

export async function fetchPersonDetail(id: string): Promise<PersonWithLastInteraction> {
  return withTenant(async () => getPersonWithInteractions(id));
}

export async function fetchOverdueContacts(): Promise<Person[]> {
  return withTenant(async () => listOverdueContacts());
}

export async function fetchUpcomingBirthdays(
  days = 60,
): Promise<Array<Person & { days_until: number }>> {
  return withTenant(async () => listUpcomingBirthdays(days));
}

export async function fetchRecentInteractions(limit = 20): Promise<InteractionWithPerson[]> {
  return withTenant(async () => listRecentInteractions(limit));
}

export async function fetchNetworkStats(): Promise<NetworkStats> {
  return withTenant(async () => getNetworkStats());
}

export async function addPerson(input: CreatePersonInput): Promise<Person> {
  return withTenant(async () => createPerson(input));
}

export async function editPerson(id: string, input: UpdatePersonInput): Promise<Person> {
  return withTenant(async () => updatePerson(id, input));
}

export async function removePerson(id: string): Promise<void> {
  return withTenant(async () => deletePerson(id));
}

export async function addInteraction(input: {
  person_id: string;
  type: InteractionType;
  channel?: InteractionChannel;
  summary?: string;
  sentiment?: InteractionSentiment;
  duration_minutes?: number;
}): Promise<Interaction> {
  return withTenant(async () => logInteraction(input));
}

export async function fetchDormantContacts(days = 30): Promise<Person[]> {
  return withTenant(async () => {
    try {
      return await getDormantContacts(days);
    } catch (_err) {
      return [];
    }
  });
}

export async function fetchUpcomingBirthdaysShort(
  days = 14,
): Promise<Array<Person & { days_until: number }>> {
  return withTenant(async () => {
    try {
      return await listUpcomingBirthdays(days);
    } catch (_err) {
      return [];
    }
  });
}

export async function fetchPendingFollowups(): Promise<
  (ContactReminder & { person_name: string })[]
> {
  return withTenant(async () => {
    try {
      return await listPendingReminders();
    } catch (_err) {
      return [];
    }
  });
}
