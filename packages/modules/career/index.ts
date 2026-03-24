// Module: Career / Carreira
// Gestão de workspaces, projetos, registro de horas e currículo

export type {
  Workspace,
  Project,
  WorkLog,
  WorkSummary,
  LogWorkInput,
  WorkspaceType,
  ProjectStatus,
} from './types';

export type {
  CareerProfile,
  CareerExperience,
  CareerEducation,
  CareerSkill,
  CareerCertification,
  CreateProfileInput,
  CreateExperienceInput,
  CreateEducationInput,
  CreateSkillInput,
  CreateCertificationInput,
  SkillCategory,
} from './career-types';

export {
  listWorkspaces,
  findWorkspaceByName,
  listActiveProjects,
  findProjectByName,
  logWork,
  getWorkSummary,
  listRecentWorkLogs,
} from './queries';

export {
  getCareerProfile,
  upsertCareerProfile,
  listCareerExperiences,
  upsertCareerExperience,
  deleteCareerExperience,
  listCareerEducations,
  upsertCareerEducation,
  deleteCareerEducation,
  listCareerSkills,
  upsertCareerSkill,
  deleteCareerSkill,
  listCareerCertifications,
  upsertCareerCertification,
  deleteCareerCertification,
} from './career-queries';

export { horasCommand, projetosCommand, handleHoras, handleProjetos } from './commands';

export {
  perfilCommand,
  experienciaCommand,
  formacaoCommand,
  skillCommand,
  certificadoCommand,
  handlePerfil,
  handleExperiencia,
  handleFormacao,
  handleSkill,
  handleCertificado,
} from './career-commands';

export { loadL0, loadL1, loadL2 } from './context';
