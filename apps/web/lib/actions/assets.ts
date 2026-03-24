'use server';

import {
  createAsset,
  createDocument,
  deleteAsset,
  deleteDocument,
  getTotalAssetValue,
  listAssets,
  listDocuments,
  listExpiringDocuments,
  updateAsset,
  updateDocument,
} from '@hawk/module-assets/queries';
import { withTenant } from '../supabase/with-tenant';

import type {
  Asset,
  AssetCondition,
  AssetType,
  Document,
  DocumentType,
  UpdateAssetInput,
  UpdateDocumentInput,
} from '@hawk/module-assets/types';

export async function fetchAssets(type?: AssetType): Promise<Asset[]> {
  return withTenant(async () => listAssets(type));
}

export async function fetchDocuments(type?: DocumentType): Promise<Document[]> {
  return withTenant(async () => listDocuments(type));
}

export async function fetchExpiringDocuments(days = 30): Promise<Document[]> {
  return withTenant(async () => listExpiringDocuments(days));
}

export async function fetchTotalAssetValue(): Promise<number> {
  return withTenant(async () => getTotalAssetValue());
}

export async function createAssetAction(input: {
  name: string;
  type: AssetType;
  value?: number;
  condition?: AssetCondition;
}): Promise<Asset> {
  return withTenant(async () => createAsset(input));
}

export async function createDocumentAction(input: {
  name: string;
  type: DocumentType;
  description?: string;
  expires_at?: string;
}): Promise<Document> {
  return withTenant(async () =>
    createDocument({ name: input.name, type: input.type, expiry_date: input.expires_at }),
  );
}

export async function deleteAssetAction(id: string): Promise<void> {
  return withTenant(async () => deleteAsset(id));
}

export async function deleteDocumentAction(id: string): Promise<void> {
  return withTenant(async () => deleteDocument(id));
}

export async function editAssetAction(id: string, updates: UpdateAssetInput): Promise<Asset> {
  return withTenant(async () => updateAsset(id, updates));
}

export async function editDocumentAction(
  id: string,
  updates: UpdateDocumentInput,
): Promise<Document> {
  return withTenant(async () => updateDocument(id, updates));
}
