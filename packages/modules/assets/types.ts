// Types: Assets / Bens e Documentos

export type AssetType =
  | 'electronics'
  | 'vehicle'
  | 'real_estate'
  | 'investment'
  | 'furniture'
  | 'other';
export type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor';
export type DocumentType =
  | 'identity'
  | 'contract'
  | 'tax'
  | 'health'
  | 'property'
  | 'vehicle'
  | 'other';

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  value: number | null;
  purchase_date: string | null;
  condition: AssetCondition | null;
  location: string | null;
  insured: boolean;
  insurance_expiry: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type Document = {
  id: string;
  name: string;
  type: DocumentType;
  entity: string | null;
  expires_at: string | null;
  file_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type CreateAssetInput = {
  name: string;
  type: AssetType;
  value?: number;
  purchase_date?: string;
  condition?: AssetCondition;
  location?: string;
  insured?: boolean;
  insurance_expiry?: string;
  notes?: string;
};

export type CreateDocumentInput = {
  name: string;
  type: DocumentType;
  entity?: string;
  expiry_date?: string;
  file_url?: string;
  notes?: string;
};

export type UpdateAssetInput = {
  name?: string;
  type?: AssetType;
  value?: number;
  condition?: AssetCondition;
  notes?: string;
  purchase_date?: string;
};

export type UpdateDocumentInput = {
  name?: string;
  type?: DocumentType;
  expires_at?: string;
  notes?: string;
};
