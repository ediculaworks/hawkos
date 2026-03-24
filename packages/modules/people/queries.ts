import { db } from '@hawk/db';
import type { PaginatedResult } from '@hawk/shared';
import type {
  ActivityLogEntry,
  ContactReminder,
  CreateContactReminderInput,
  CreatePersonInput,
  CreateRelationshipInput,
  CreateSpecialDateInput,
  Interaction,
  InteractionWithPerson,
  LogActivityInput,
  LogInteractionInput,
  NetworkStats,
  Person,
  PersonRelationshipWithPeople,
  PersonWithLastInteraction,
  Relationship,
  SpecialDate,
  UpdateHowWeMetInput,
  UpdatePersonInput,
} from './types';

/**
 * Buscar pessoa por nome (parcial)
 */
export async function findPersonByName(name: string): Promise<Person | null> {
  const { data, error } = await db
    .from('people')
    .select('*')
    .eq('active', true)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to find person: ${error.message}`);
  return data as Person | null;
}

/**
 * Obter pessoa por ID com histórico de interações
 */
export async function getPersonWithInteractions(id: string): Promise<PersonWithLastInteraction> {
  const { data: person, error } = await db.from('people').select('*').eq('id', id).single();

  if (error) throw new Error(`Failed to get person: ${error.message}`);

  const { data: interactions, error: intError } = await db
    .from('interactions')
    .select('*')
    .eq('person_id', id)
    .order('date', { ascending: false })
    .limit(10);

  if (intError) throw new Error(`Failed to get interactions: ${intError.message}`);

  const p = person as Person;
  const daysSince = p.last_interaction
    ? Math.floor((Date.now() - new Date(p.last_interaction).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const overdueContact = p.next_contact_reminder
    ? new Date(p.next_contact_reminder) < new Date()
    : false;

  return {
    ...p,
    interactions: (interactions ?? []) as Interaction[],
    days_since_contact: daysSince,
    overdue_contact: overdueContact,
  };
}

/**
 * Listar pessoas que precisam de contato (next_contact_reminder vencido ou próximo)
 */
export async function listOverdueContacts(): Promise<Person[]> {
  const today = new Date().toISOString().split('T')[0] as string;

  const { data, error } = await db
    .from('people')
    .select('*')
    .eq('active', true)
    .lte('next_contact_reminder', today)
    .not('next_contact_reminder', 'is', null)
    .order('next_contact_reminder', { ascending: true });

  if (error) throw new Error(`Failed to list overdue contacts: ${error.message}`);
  return (data ?? []) as Person[];
}

/**
 * Próximos aniversários (próximos N dias)
 */
export async function listUpcomingBirthdays(
  days = 30,
): Promise<Array<Person & { days_until: number }>> {
  const { data, error } = await db
    .from('people')
    .select('*')
    .eq('active', true)
    .not('birthday', 'is', null);

  if (error) throw new Error(`Failed to get birthdays: ${error.message}`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = (data ?? [])
    .map((p) => {
      const birthday = new Date(p.birthday as string);
      // Calcular aniversário deste ano
      const thisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      // Se já passou, calcular para o próximo ano
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...(p as Person), days_until: daysUntil };
    })
    .filter((p) => p.days_until <= days)
    .sort((a, b) => a.days_until - b.days_until);

  return upcoming;
}

/**
 * Registrar interação
 */
export async function logInteraction(input: LogInteractionInput): Promise<Interaction> {
  const { data, error } = await db
    .from('interactions')
    .insert({
      person_id: input.person_id,
      type: input.type,
      channel: input.channel ?? null,
      summary: input.summary ?? null,
      sentiment: input.sentiment ?? null,
      duration_minutes: input.duration_minutes ?? null,
      date: input.date ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log interaction: ${error.message}`);
  return data as Interaction;
}

/**
 * Criar contato
 */
export async function createPerson(input: CreatePersonInput): Promise<Person> {
  const { data, error } = await db
    .from('people')
    .insert({
      name: input.name,
      relationship: input.relationship ?? null,
      role: input.role ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      birthday: input.birthday ?? null,
      city: input.city ?? null,
      notes: input.notes ?? null,
      importance: input.importance ?? 5,
      contact_frequency: input.contact_frequency ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create person: ${error.message}`);
  return data as Person;
}

/**
 * Atualizar contato
 */
export async function updatePerson(id: string, input: UpdatePersonInput): Promise<Person> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.relationship !== undefined) updates.relationship = input.relationship;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.email !== undefined) updates.email = input.email;
  if (input.city !== undefined) updates.city = input.city;
  if (input.importance !== undefined) updates.importance = input.importance;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.birthday !== undefined) updates.birthday = input.birthday;
  if (input.company !== undefined) updates.company = input.company;
  if (input.role !== undefined) updates.role = input.role;

  const { data, error } = await db.from('people').update(updates).eq('id', id).select().single();
  if (error) throw new Error(`Failed to update person: ${error.message}`);
  return data as Person;
}

/**
 * Desativar contato (soft delete)
 */
export async function deletePerson(id: string): Promise<void> {
  const { error } = await db.from('people').update({ active: false }).eq('id', id);
  if (error) throw new Error(`Failed to delete person: ${error.message}`);
}

/**
 * Listar todos os contatos ativos por importância
 */
export async function listPeople(limit = 20, offset = 0): Promise<PaginatedResult<Person>> {
  const { data, error, count } = await db
    .from('people')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .order('importance', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list people: ${error.message}`);
  const total = count ?? 0;
  return { data: (data ?? []) as Person[], total, hasMore: offset + limit < total };
}

/**
 * Interações recentes cross-person (feed de atividade)
 */
export async function listRecentInteractions(limit = 20): Promise<InteractionWithPerson[]> {
  const { data, error } = await db
    .from('interactions')
    .select('*, people!inner(name, relationship)')
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list recent interactions: ${error.message}`);

  return (data ?? []).map((row) => {
    const person = (row as Record<string, unknown>).people as {
      name: string;
      relationship: string | null;
    } | null;
    return {
      ...(row as unknown as Interaction),
      person_name: person?.name ?? 'Desconhecido',
      person_relationship: (person?.relationship as Relationship) ?? null,
    };
  });
}

/**
 * Estatísticas da rede de contatos
 */
export async function getNetworkStats(): Promise<NetworkStats> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const todayStr = today.toISOString().split('T')[0] as string;
  const weekAgoStr = weekAgo.toISOString();

  // Active contacts
  const { data: people } = await db
    .from('people')
    .select('id, contact_frequency, next_contact_reminder')
    .eq('active', true);

  const active = people ?? [];
  const withFrequency = active.filter(
    (p) => p.contact_frequency && p.contact_frequency !== 'as_needed',
  );
  const overdue = active.filter(
    (p) => p.next_contact_reminder && p.next_contact_reminder <= todayStr,
  );
  const onSchedule =
    withFrequency.length > 0 ? (withFrequency.length - overdue.length) / withFrequency.length : 1;

  // Interactions last 7 days
  const { data: recentInteractions } = await db
    .from('interactions')
    .select('sentiment')
    .gte('date', weekAgoStr);

  const interactions7d = recentInteractions ?? [];

  // Avg sentiment (positive=1, neutral=0, negative=-1)
  const { data: monthInteractions } = await db
    .from('interactions')
    .select('sentiment')
    .gte('date', monthAgo.toISOString());

  const sentimentValues: number[] = (monthInteractions ?? []).map((i) =>
    i.sentiment === 'positive' ? 1 : i.sentiment === 'negative' ? -1 : 0,
  );
  const avgSentiment =
    sentimentValues.length > 0
      ? sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length
      : 0;

  return {
    active_contacts: active.length,
    overdue_count: overdue.length,
    contact_rate: Math.round(onSchedule * 100) / 100,
    interactions_last_7d: interactions7d.length,
    avg_sentiment: Math.round(avgSentiment * 100) / 100,
  };
}

/**
 * Buscar pessoas por nome (para @mentions — retorna múltiplos)
 */
export async function searchPeople(query: string, limit = 5): Promise<Person[]> {
  const { data, error } = await db
    .from('people')
    .select('*')
    .eq('active', true)
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (error) throw new Error(`Failed to search people: ${error.message}`);
  return (data ?? []) as Person[];
}

// ── Monica Enhancements ────────────────────────────────────────

/**
 * Contatos que não tiveram interação há N dias (dormant contacts)
 */
export async function getDormantContacts(days = 30): Promise<Person[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const { data, error } = await db
    .from('people')
    .select('*')
    .eq('active', true)
    .or(`last_interaction.lt.${cutoffStr},last_interaction.is.null`)
    .order('last_interaction', { ascending: true, nullsFirst: true });

  if (error) throw new Error(`Failed to get dormant contacts: ${error.message}`);
  return (data ?? []) as Person[];
}

/**
 * Atualizar "como nos conhecemos"
 */
export async function updateHowWeMet(input: UpdateHowWeMetInput): Promise<Person> {
  // biome-ignore lint/suspicious/noExplicitAny: how_we_met/first_met_at/first_met_location not in generated types
  const { data, error } = await (db as any)
    .from('people')
    .update({
      how_we_met: input.how_we_met,
      first_met_at: input.first_met_at ?? null,
      first_met_location: input.first_met_location ?? null,
    })
    .eq('id', input.person_id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update how_we_met: ${error.message}`);
  return data as Person;
}

/**
 * Datas especiais de uma pessoa
 */
export async function getSpecialDates(personId: string): Promise<SpecialDate[]> {
  // biome-ignore lint/suspicious/noExplicitAny: special_dates not in generated types
  const { data, error } = await (db as any)
    .from('special_dates')
    .select('*')
    .eq('person_id', personId)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to get special dates: ${error.message}`);
  return (data ?? []) as unknown as SpecialDate[];
}

/**
 * Criar data especial
 */
export async function createSpecialDate(input: CreateSpecialDateInput): Promise<SpecialDate> {
  // biome-ignore lint/suspicious/noExplicitAny: special_dates not in generated types
  const { data, error } = await (db as any)
    .from('special_dates')
    .insert({
      person_id: input.person_id,
      label: input.label,
      date: input.date,
      is_year_unknown: input.is_year_unknown ?? false,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create special date: ${error.message}`);
  return data as SpecialDate;
}

/**
 * Lembretes de contato pendentes (active, next_expected_date <= hoje)
 */
export async function listPendingReminders(): Promise<
  (ContactReminder & { person_name: string })[]
> {
  const today = new Date().toISOString().split('T')[0];

  // biome-ignore lint/suspicious/noExplicitAny: contact_reminders not in generated types
  const { data, error } = await (db as any)
    .from('contact_reminders')
    .select('*, people!inner(name)')
    .eq('active', true)
    .lte('next_expected_date', today)
    .order('next_expected_date', { ascending: true });

  if (error) throw new Error(`Failed to list pending reminders: ${error.message}`);

  // biome-ignore lint/suspicious/noExplicitAny: contact_reminders join result not typed
  return (data ?? []).map((row: any) => {
    const person = (row as Record<string, unknown>).people as { name: string } | null;
    return {
      ...(row as unknown as ContactReminder),
      person_name: person?.name ?? 'Desconhecido',
    };
  });
}

/**
 * Criar lembrete de contato
 */
export async function createContactReminder(
  input: CreateContactReminderInput,
): Promise<ContactReminder> {
  const next = calculateNextReminder(
    input.initial_date,
    input.frequency_type,
    input.frequency_value ?? 1,
  );

  // biome-ignore lint/suspicious/noExplicitAny: contact_reminders not in generated types
  const { data, error } = await (db as any)
    .from('contact_reminders')
    .insert({
      person_id: input.person_id,
      frequency_type: input.frequency_type,
      frequency_value: input.frequency_value ?? 1,
      initial_date: input.initial_date,
      next_expected_date: next,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create contact reminder: ${error.message}`);
  return data as ContactReminder;
}

/**
 * Calcular próxima data de lembrete
 */
function calculateNextReminder(fromDate: string, frequency: string, value: number): string {
  const date = new Date(fromDate);
  switch (frequency) {
    case 'once':
      return fromDate;
    case 'week':
      date.setDate(date.getDate() + 7 * value);
      break;
    case 'month':
      date.setMonth(date.getMonth() + value);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + value);
      break;
  }
  return date.toISOString().split('T')[0] as string;
}

/**
 * Desativar lembrete de contato
 */
export async function deactivateReminder(reminderId: string): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: contact_reminders not in generated types
  const { error } = await (db as any)
    .from('contact_reminders')
    .update({ active: false })
    .eq('id', reminderId);

  if (error) throw new Error(`Failed to deactivate reminder: ${error.message}`);
}

// ============================================================
// ACTIVITY TIMELINE (Twenty pattern)
// ============================================================

/**
 * Registrar uma atividade na timeline de uma entidade
 */
export async function logActivity(input: LogActivityInput): Promise<ActivityLogEntry> {
  // biome-ignore lint/suspicious/noExplicitAny: entity_activity_log not in generated types
  const { data, error } = await (db as any)
    .from('entity_activity_log')
    .insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      activity_type: input.activity_type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log activity: ${error.message}`);
  return data as unknown as ActivityLogEntry;
}

/**
 * Buscar timeline de atividades de uma entidade
 */
export async function getActivityTimeline(
  entityType: string,
  entityId: string,
  limit = 20,
): Promise<ActivityLogEntry[]> {
  // biome-ignore lint/suspicious/noExplicitAny: entity_activity_log not in generated types
  const { data, error } = await (db as any)
    .from('entity_activity_log')
    .select('id, entity_type, entity_id, activity_type, title, body, metadata, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get activity timeline: ${error.message}`);
  return (data ?? []) as unknown as ActivityLogEntry[];
}

// ============================================================
// RELATIONSHIPS (Twenty pattern)
// ============================================================

/**
 * Listar relacionamentos de uma pessoa com nomes resolvidos
 */
export async function getRelationships(personId: string): Promise<PersonRelationshipWithPeople[]> {
  // biome-ignore lint/suspicious/noExplicitAny: people_relationships not in generated types
  const { data, error } = await (db as any)
    .from('people_relationships')
    .select(
      `id, person_a, person_b, relationship_type, strength, notes, created_at,
       pa:people!person_a(name), pb:people!person_b(name)`,
    )
    .or(`person_a.eq.${personId},person_b.eq.${personId}`)
    .order('strength', { ascending: false });

  if (error) throw new Error(`Failed to get relationships: ${error.message}`);

  // biome-ignore lint/suspicious/noExplicitAny: people_relationships join result not typed
  return (data ?? []).map((r: any) => ({
    id: r.id,
    person_a: r.person_a,
    person_b: r.person_b,
    relationship_type: r.relationship_type,
    strength: r.strength,
    notes: r.notes,
    created_at: r.created_at,
    person_a_name: r.pa?.name ?? '',
    person_b_name: r.pb?.name ?? '',
  }));
}

/**
 * Criar ou atualizar um relacionamento entre duas pessoas
 */
export async function createRelationship(
  input: CreateRelationshipInput,
): Promise<PersonRelationshipWithPeople> {
  const [a, b] = [input.person_a, input.person_b].sort(); // canonical ordering

  // biome-ignore lint/suspicious/noExplicitAny: people_relationships not in generated types
  const { data, error } = await (db as any)
    .from('people_relationships')
    .upsert(
      {
        person_a: a,
        person_b: b,
        relationship_type: input.relationship_type,
        strength: input.strength ?? 3,
        notes: input.notes ?? null,
      },
      { onConflict: 'person_a,person_b' },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to create relationship: ${error.message}`);

  // biome-ignore lint/suspicious/noExplicitAny: people_relationships not in generated types
  const rel = data as any;
  // Fetch names in parallel, handle missing people gracefully (avoid race condition if deleted)
  const [paResult, pbResult] = await Promise.all([
    db.from('people').select('name').eq('id', rel.person_a).maybeSingle(),
    db.from('people').select('name').eq('id', rel.person_b).maybeSingle(),
  ]);

  return {
    ...rel,
    person_a_name: paResult.data?.name ?? '(removido)',
    person_b_name: pbResult.data?.name ?? '(removido)',
  };
}
