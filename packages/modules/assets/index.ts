// Module: Assets / Bens e Documentos

export type {
  Asset,
  Document,
  CreateAssetInput,
  CreateDocumentInput,
  UpdateAssetInput,
  UpdateDocumentInput,
  AssetType,
  AssetCondition,
  DocumentType,
} from './types';
export {
  createAsset,
  listAssets,
  createDocument,
  listDocuments,
  listExpiringDocuments,
  getTotalAssetValue,
  searchDocuments,
  getUncategorizedDocuments,
  updateAsset,
  updateDocument,
} from './queries';
export { bemCommand, documentoCommand, handleBem, handleDocumento } from './commands';
export { loadL0, loadL1, loadL2 } from './context';
