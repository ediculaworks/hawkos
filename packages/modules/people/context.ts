// Context Engine: People / CRM
import {
  getDormantContacts,
  listOverdueContacts,
  listPendingReminders,
  listPeople,
  listUpcomingBirthdays,
} from './queries';

export async function loadL0(): Promise<string> {
  try {
    const [dormant, overdue, birthdays, pending] = await Promise.all([
      getDormantContacts(30),
      listOverdueContacts(),
      listUpcomingBirthdays(7),
      listPendingReminders(),
    ]);

    const parts: string[] = [];
    if (dormant.length > 0) {
      parts.push(
        `Dormant: ${dormant
          .slice(0, 3)
          .map((p) => p.name)
          .join(', ')}${dormant.length > 3 ? ` +${dormant.length - 3}` : ''}`,
      );
    }
    if (overdue.length > 0) {
      parts.push(
        `Pendentes: ${overdue
          .slice(0, 3)
          .map((p) => p.name)
          .join(', ')}${overdue.length > 3 ? ` +${overdue.length - 3}` : ''}`,
      );
    }
    if (birthdays.length > 0) {
      parts.push(
        `Aniversários: ${birthdays.map((p) => `${p.name} (${p.days_until === 0 ? 'hoje' : `em ${p.days_until}d`})`).join(', ')}`,
      );
    }
    if (pending.length > 0) {
      parts.push(`${pending.length} follow-ups overdue`);
    }
    return parts.length > 0 ? parts.join('\n') : 'CRM: nenhuma ação urgente.';
  } catch (_error) {
    return 'CRM: indisponível';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const [dormant, overdue, birthdays, pending] = await Promise.all([
      getDormantContacts(30),
      listOverdueContacts(),
      listUpcomingBirthdays(30),
      listPendingReminders(),
    ]);

    const parts: string[] = ['CRM:'];
    if (dormant.length > 0) {
      parts.push(`Dormant (${dormant.length}): ${dormant.map((p) => p.name).join(', ')}`);
    }
    if (overdue.length > 0) {
      parts.push(`Overdue (${overdue.length}): ${overdue.map((p) => p.name).join(', ')}`);
    }
    if (birthdays.length > 0) {
      parts.push(
        `Aniversários/30d: ${birthdays.map((p) => `${p.name} (${p.days_until}d)`).join(', ')}`,
      );
    }
    if (pending.length > 0) {
      parts.push(`Follow-ups pendentes: ${pending.map((r) => r.person_name).join(', ')}`);
    }
    return parts.join('\n');
  } catch (_error) {
    return 'CRM (detalhes): indisponível';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const people = await listPeople(30);
    if (people.data.length === 0) return 'CRM: nenhum contato cadastrado.';

    const lines = people.data.map((p) => {
      const lastContact = p.last_interaction
        ? `último contato: ${new Date(p.last_interaction).toLocaleDateString('pt-BR')}`
        : 'sem contato registrado';
      return `• **${p.name}** (${p.relationship ?? 'sem rel'}, imp: ${p.importance}/10) — ${lastContact}`;
    });

    return `CRM — contatos:\n${lines.join('\n')}`;
  } catch (_error) {
    return 'CRM (contatos): indisponível';
  }
}
