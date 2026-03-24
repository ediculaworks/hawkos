// Module: Housing / Moradia

export type {
  Residence,
  HousingBill,
  MaintenanceLog,
  CreateBillInput,
  CreateMaintenanceInput,
  UpdateBillInput,
  UpdateMaintenanceInput,
  BillStatus,
  MaintenanceCategory,
} from './types';
export {
  listResidences,
  getPrimaryResidence,
  createBill,
  listBills,
  markBillPaid,
  getPendingBills,
  createMaintenance,
  listMaintenance,
  getMonthlyBillTotal,
  deleteBill,
  deleteMaintenanceLog,
  updateBill,
  updateMaintenanceLog,
} from './queries';
export { moradiaCommand, contaCommand, handleMoradia, handleConta } from './commands';
export { loadL0, loadL1, loadL2 } from './context';
