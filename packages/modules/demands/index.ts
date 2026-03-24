// Module: Demands
// Sistema de execução multi-agent para tarefas de longa duração

export type {
  Demand,
  DemandStep,
  DemandLog,
  DemandArtifact,
  DemandWithSteps,
  DemandFull,
  DemandStatus,
  DemandPriority,
  DemandOrigin,
  StepExecutionType,
  StepStatus,
  LogType,
  ArtifactType,
  TriageResult,
  TriageStep,
  CreateDemandInput,
  UpdateDemandInput,
  CreateStepInput,
  UpdateStepInput,
  CreateLogInput,
  CreateArtifactInput,
} from './types';

export {
  createDemand,
  updateDemand,
  getDemand,
  deleteDemand,
  listDemands,
  getActiveDemands,
  getDemandWithSteps,
  getDemandFull,
  createStep,
  updateStep,
  listSteps,
  getReadySteps,
  getStepsByStatus,
  createLog,
  listLogs,
  createArtifact,
  listArtifacts,
  updateDemandProgress,
  resolveDependencies,
} from './queries';

export { triageDemand } from './triage';
export { processDemandQueue, setDemandNotifier } from './engine';
export { demandaCommand, handleDemanda } from './commands';
export { loadL0, loadL1, loadL2 } from './context';
