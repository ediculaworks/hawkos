import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';
import type {
  Asset,
  AssetType,
  CreateAssetInput,
  CreateDocumentInput,
  Document,
  DocumentType,
  UpdateAssetInput,
  UpdateDocumentInput,
} from './types';
const logger = createLogger('assets');

const CreateAssetSchema = z.object({ name: z.string().min(1) });

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const parsed = CreateAssetSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  const { data, error } = await db
    .from('assets')
    .insert({
      name: input.name,
      type: input.type,
      value: input.value ?? null,
      purchase_date: input.purchase_date ?? null,
      condition: input.condition ?? null,
      location: input.location ?? null,
      insured: input.insured ?? false,
      insurance_expiry: input.insurance_expiry ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create asset');
    throw new HawkError(`Failed to create asset: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Asset;
}

export async function listAssets(type?: AssetType): Promise<Asset[]> {
  let query = db.from('assets').select('*').order('name', { ascending: true });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list assets');
    throw new HawkError(`Failed to list assets: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return (data ?? []) as Asset[];
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const { data, error } = await db
    .from('documents')
    .insert({
      name: input.name,
      type: input.type,
      entity: input.entity ?? null,
      expires_at: input.expiry_date ?? null,
      file_url: input.file_url ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create document');
    throw new HawkError(`Failed to create document: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Document;
}

export async function listDocuments(type?: DocumentType): Promise<Document[]> {
  let query = db.from('documents').select('*').order('name', { ascending: true });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list documents');
    throw new HawkError(`Failed to list documents: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Document[];
}

export async function listExpiringDocuments(daysAhead = 30): Promise<Document[]> {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  const { data, error } = await db
    .from('documents')
    .select('*')
    .not('expires_at', 'is', null)
    .lte('expires_at', future.toISOString().split('T')[0])
    .gte('expires_at', now.toISOString().split('T')[0])
    .order('expires_at', { ascending: true });

  if (error) {
    logger.error({ error: error.message }, 'Failed to list expiring documents');
    throw new HawkError(`Failed to list expiring documents: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Document[];
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await db.from('assets').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete asset');
    throw new HawkError(`Failed to delete asset: ${error.message}`, 'DB_UPDATE_FAILED');
  }
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await db.from('documents').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete document');
    throw new HawkError(`Failed to delete document: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<Asset> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.value !== undefined) updates.value = input.value;
  if (input.condition !== undefined) updates.condition = input.condition;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.purchase_date !== undefined) updates.purchase_date = input.purchase_date;

  const { data, error } = await db.from('assets').update(updates).eq('id', id).select().single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to update asset');
    throw new HawkError(`Failed to update asset: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as Asset;
}

export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<Document> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.expires_at !== undefined) updates.expires_at = input.expires_at;
  if (input.notes !== undefined) updates.notes = input.notes;

  const { data, error } = await db.from('documents').update(updates).eq('id', id).select().single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to update document');
    throw new HawkError(`Failed to update document: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as Document;
}

export async function getTotalAssetValue(): Promise<number> {
  const { data, error } = await db.from('assets').select('value').not('value', 'is', null);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get asset value');
    throw new HawkError(`Failed to get asset value: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return (data ?? []).reduce((sum: any, row: any) => sum + (row.value ?? 0), 0);
}

// ============================================================
// DOCUMENT SEARCH (Paperless-ngx pattern)
// ============================================================

/**
 * Busca full-text em documentos (título + conteúdo OCR)
 */
export async function searchDocuments(query: string, limit = 10): Promise<Document[]> {
  const { data, error } = await db
    .from('documents')
    .select('id, name, type, entity, expires_at, file_url, notes, created_at')
    .or(`name.ilike.%${query}%,content.ilike.%${query}%`)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search documents');
    throw new HawkError(`Failed to search documents: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as Document[];
}

/**
 * Documentos que precisam ser arquivados (sem document_type_id atribuído)
 */
export async function getUncategorizedDocuments(limit = 20): Promise<Document[]> {
  const { data, error } = await db
    .from('documents')
    .select('id, name, type, entity, file_url, notes, created_at')
    .is('document_type_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get uncategorized documents');
    throw new HawkError(
      `Failed to get uncategorized documents: ${error.message}`,
      'DB_QUERY_FAILED',
    );
  }
  return (data ?? []) as unknown as Document[];
}
