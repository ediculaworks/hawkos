// Types: People / CRM

export type Relationship =
  | 'family'
  | 'friend'
  | 'colleague'
  | 'romantic'
  | 'professional'
  | 'medical';
export type ContactFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'as_needed';
export type InteractionType = 'call' | 'meeting' | 'message' | 'visit' | 'email';
export type InteractionChannel = 'whatsapp' | 'discord' | 'phone' | 'in_person' | 'email' | 'other';
export type InteractionSentiment = 'positive' | 'neutral' | 'negative';

export type SpecialDateLabel = 'birthday' | 'anniversary' | 'first_met' | 'death';
export type ReminderFrequencyType = 'once' | 'week' | 'month' | 'year';

export type Person = {
  id: string;
  name: string;
  relationship: Relationship | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null; // YYYY-MM-DD
  city: string | null;
  notes: string | null;
  importance: number; // 1-10
  contact_frequency: ContactFrequency | null;
  last_interaction: string | null;
  next_contact_reminder: string | null; // YYYY-MM-DD
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Monica enhancements
  how_we_met: string | null;
  first_met_at: string | null;
  first_met_location: string | null;
};

export type SpecialDate = {
  id: string;
  person_id: string;
  label: SpecialDateLabel;
  date: string; // YYYY-MM-DD
  is_year_unknown: boolean;
  description: string | null;
  created_at: string;
};

export type ContactReminder = {
  id: string;
  person_id: string;
  frequency_type: ReminderFrequencyType;
  frequency_value: number;
  initial_date: string; // YYYY-MM-DD
  next_expected_date: string | null;
  last_triggered_at: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type Interaction = {
  id: string;
  person_id: string;
  type: InteractionType;
  channel: InteractionChannel | null;
  summary: string | null;
  sentiment: InteractionSentiment | null;
  duration_minutes: number | null;
  date: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PersonWithLastInteraction = Person & {
  interactions: Interaction[];
  days_since_contact: number | null;
  overdue_contact: boolean;
};

export type CreatePersonInput = {
  name: string;
  relationship?: Relationship;
  role?: string;
  phone?: string;
  email?: string;
  birthday?: string;
  city?: string;
  notes?: string;
  importance?: number;
  contact_frequency?: ContactFrequency;
};

export type UpdatePersonInput = {
  name?: string;
  relationship?: Relationship;
  phone?: string;
  email?: string;
  city?: string;
  importance?: number;
  notes?: string;
  birthday?: string;
  company?: string;
  role?: string;
};

export type InteractionWithPerson = Interaction & {
  person_name: string;
  person_relationship: Relationship | null;
};

export type NetworkStats = {
  active_contacts: number;
  overdue_count: number;
  contact_rate: number;
  interactions_last_7d: number;
  avg_sentiment: number;
};

export type LogInteractionInput = {
  person_id: string;
  type: InteractionType;
  channel?: InteractionChannel;
  summary?: string;
  sentiment?: InteractionSentiment;
  duration_minutes?: number;
  date?: string;
};

export type CreateSpecialDateInput = {
  person_id: string;
  label: SpecialDateLabel;
  date: string;
  is_year_unknown?: boolean;
  description?: string;
};

export type CreateContactReminderInput = {
  person_id: string;
  frequency_type: ReminderFrequencyType;
  frequency_value?: number;
  initial_date: string;
  description?: string;
};

export type UpdateHowWeMetInput = {
  person_id: string;
  how_we_met: string;
  first_met_at?: string;
  first_met_location?: string;
};

export type PersonWithExtras = Person & {
  days_since_contact: number | null;
  overdue_contact: boolean;
  special_dates?: SpecialDate[];
  reminders?: ContactReminder[];
};

// ── Twenty-inspired Activity Timeline ─────────────────────

export type EntityType =
  | 'person'
  | 'company'
  | 'deal'
  | 'task'
  | 'contract'
  | 'asset'
  | 'event'
  | 'workspace';

export type ActivityLogEntry = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  activity_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LogActivityInput = {
  entity_type: EntityType;
  entity_id: string;
  activity_type: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
};

// ── Twenty-inspired Relationships ─────────────────────────

export type RelationshipType =
  | 'colleague'
  | 'friend'
  | 'mentor'
  | 'mentee'
  | 'family'
  | 'investor'
  | 'partner'
  | 'client'
  | 'supplier'
  | 'acquaintance'
  | 'other';

export type PersonRelationship = {
  id: string;
  person_a: string;
  person_b: string;
  relationship_type: RelationshipType;
  strength: number; // 1-5
  notes: string | null;
  created_at: string;
};

export type PersonRelationshipWithPeople = PersonRelationship & {
  person_a_name: string;
  person_b_name: string;
};

export type CreateRelationshipInput = {
  person_a: string;
  person_b: string;
  relationship_type: RelationshipType;
  strength?: number;
  notes?: string;
};
