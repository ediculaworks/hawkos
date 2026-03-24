// Module: Legal / Jurídico
// Entidades jurídicas, obrigações fiscais e contratos

export type {
  LegalEntity,
  LegalObligation,
  Contract,
  ObligationWithDaysLeft,
  LegalEntityType,
  ObligationType,
  ObligationFrequency,
  ObligationStatus,
  ContractType,
  ContractStatus,
  CreateObligationInput,
  UpdateObligationInput,
  CreateContractInput,
  UpdateContractInput,
  CreateLegalEntityInput,
  UpdateLegalEntityInput,
} from './types';

export {
  listPendingObligations,
  completeObligation,
  listActiveContracts,
  listAllContracts,
  listLegalEntities,
  getUrgentObligations,
  getExpiringContracts,
  deleteObligation,
  deleteContract,
  deleteLegalEntity,
  createObligation,
  createContract,
  createLegalEntity,
  updateObligation,
  updateContract,
  updateLegalEntity,
  logContractAudit,
} from './queries';

export { obrigacoesCommand, contratosCommand, handleObrigacoes, handleContratos } from './commands';

export { loadL0, loadL1, loadL2 } from './context';
