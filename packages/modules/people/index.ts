// Module: People / CRM
// Gestão de contatos pessoais com rastreamento de interações e lembretes

export type {
  Person,
  Interaction,
  PersonWithLastInteraction,
  CreatePersonInput,
  UpdatePersonInput,
  LogInteractionInput,
  Relationship,
  ContactFrequency,
  InteractionType,
  InteractionChannel,
  InteractionSentiment,
  ActivityLogEntry,
  LogActivityInput,
  PersonRelationshipWithPeople,
  CreateRelationshipInput,
  RelationshipType,
  EntityType,
} from './types';

export {
  findPersonByName,
  getPersonWithInteractions,
  listOverdueContacts,
  listUpcomingBirthdays,
  logInteraction,
  createPerson,
  updatePerson,
  deletePerson,
  listPeople,
  logActivity,
  getActivityTimeline,
  getRelationships,
  createRelationship,
} from './queries';

export {
  pessoaCommand,
  interacaoCommand,
  aniversariosCommand,
  contatosCommand,
  comoNosConhecemosCommand,
  lembrarCommand,
  dormentesCommand,
  handlePessoa,
  handleInteracao,
  handleAniversarios,
  handleContatos,
  handleComoNosConhecemos,
  handleLembrar,
  handleDormentes,
} from './commands';

export { loadL0, loadL1, loadL2 } from './context';
