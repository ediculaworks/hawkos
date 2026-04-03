/**
 * Supabase-compatible Query Builder for PostgreSQL
 *
 * Provides the same `.from().select().eq().order()` API that Supabase PostgREST
 * uses, but generates SQL and executes it via postgres.js directly.
 *
 * This allows all 18 module query files to work WITHOUT syntax changes.
 */

import type postgres from 'postgres';
import { getCurrentSchema, getPool } from './sql.ts';

// ── Types ───────────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: Matches Supabase's runtime behavior — data is typed by caller via generics
interface SupabaseResult<T = any> {
  data: T | null;
  error: PostgrestError | null;
  count: number | null;
}

interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'ilike' | 'is' | 'in';

interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

interface OrFilter {
  raw: string; // PostgREST-style OR string
}

interface ContainsFilter {
  column: string;
  value: unknown;
}

interface TextSearchFilter {
  column: string;
  query: string;
  type: 'plain' | 'websearch';
  config: string;
}

interface OrderClause {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

/** Parsed foreign key embed: "relation(col1, col2)" or "alias:relation!modifier(col1, col2)" */
interface ForeignKeyEmbed {
  alias: string | null;
  relation: string;
  modifier: string | null; // 'inner', 'left', or null
  columns: string[];
  filters: Filter[];
}

// ── Helper: escape identifier ───────────────────────────────────────────────
function ident(name: string): string {
  // Simple SQL identifier escaping
  return `"${name.replace(/"/g, '""')}"`;
}

// ── Parse select string ────────────────────────────────────────────────────
function parseSelectColumns(selectStr: string): { columns: string[]; embeds: ForeignKeyEmbed[] } {
  const columns: string[] = [];
  const embeds: ForeignKeyEmbed[] = [];

  // Split respecting parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selectStr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const embedMatch = part.match(/^(?:(\w+):)?(\w+)(?:!(inner|left))?\((.+)\)$/);
    if (embedMatch) {
      const [, alias, relation, modifier, cols] = embedMatch;
      embeds.push({
        alias: alias ?? null,
        relation: relation!,
        modifier: modifier ?? null,
        columns: (cols ?? '').split(',').map((c) => c.trim()),
        filters: [],
      });
    } else {
      columns.push(part.trim());
    }
  }

  return { columns, embeds };
}

// ── Parse OR filter string (PostgREST format) ──────────────────────────────
function parseOrConditions(raw: string): string {
  // Input: "col.op.value,col.op.value" or "col.op.value,col.is.null"
  const conditions: string[] = [];

  // Split on comma but respect parentheses and dots
  const parts = raw.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    // Pattern: column.operator.value
    const dotIdx = trimmed.indexOf('.');
    if (dotIdx === -1) continue;
    const column = trimmed.slice(0, dotIdx);
    const rest = trimmed.slice(dotIdx + 1);
    const secondDot = rest.indexOf('.');
    if (secondDot === -1) continue;
    const op = rest.slice(0, secondDot);
    const value = rest.slice(secondDot + 1);

    switch (op) {
      case 'eq':
        conditions.push(`${ident(column)} = ${escapeValue(value)}`);
        break;
      case 'neq':
        conditions.push(`${ident(column)} != ${escapeValue(value)}`);
        break;
      case 'gt':
        conditions.push(`${ident(column)} > ${escapeValue(value)}`);
        break;
      case 'gte':
        conditions.push(`${ident(column)} >= ${escapeValue(value)}`);
        break;
      case 'lt':
        conditions.push(`${ident(column)} < ${escapeValue(value)}`);
        break;
      case 'lte':
        conditions.push(`${ident(column)} <= ${escapeValue(value)}`);
        break;
      case 'is':
        conditions.push(`${ident(column)} IS ${value === 'null' ? 'NULL' : value}`);
        break;
      case 'ilike':
        conditions.push(`${ident(column)} ILIKE ${escapeValue(value)}`);
        break;
      case 'like':
        conditions.push(`${ident(column)} LIKE ${escapeValue(value)}`);
        break;
      case 'in':
        // value might be wrapped in parens: (val1,val2)
        conditions.push(`${ident(column)} IN ${value.startsWith('(') ? value : `(${value})`}`);
        break;
      default:
        conditions.push(`${ident(column)} ${op} ${escapeValue(value)}`);
    }
  }

  return `(${conditions.join(' OR ')})`;
}

function escapeValue(val: unknown): string {
  if (val === null || val === undefined || val === 'null') return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  // Escape single quotes
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

// ── Query Builder ───────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: Matches Supabase's dynamic typing pattern
class QueryBuilder<T = any> {
  private _table: string;
  private _operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private _selectStr = '*';
  private _columns: string[] = ['*'];
  private _embeds: ForeignKeyEmbed[] = [];
  private _filters: Filter[] = [];
  private _orFilters: OrFilter[] = [];
  private _containsFilters: ContainsFilter[] = [];
  private _notFilters: Array<{ column: string; op: string; value: unknown }> = [];
  private _textSearchFilters: TextSearchFilter[] = [];
  private _orderClauses: OrderClause[] = [];
  private _limitCount: number | null = null;
  private _offsetCount: number | null = null;
  private _returnSingle = false;
  private _returnMaybeSingle = false;
  private _throwOnErr = false;
  private _countMode: 'exact' | null = null;
  private _headOnly = false;
  private _insertData: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private _updateData: Record<string, unknown> | null = null;
  private _upsertConflict: string | null = null;
  private _returnSelect = false; // Whether .select() was called after insert/update/delete

  constructor(table: string) {
    this._table = table;
  }

  // ── SELECT ──────────────────────────────────────────────────────────────

  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): QueryBuilder<T> {
    if (this._operation !== 'select' && columns !== undefined) {
      // .select() called after insert/update/delete — means "RETURNING"
      this._returnSelect = true;
      if (columns && columns !== '*') {
        this._selectStr = columns;
        const parsed = parseSelectColumns(columns);
        this._columns = parsed.columns;
        this._embeds = parsed.embeds;
      }
    } else {
      this._operation = 'select';
      this._selectStr = columns || '*';
      const parsed = parseSelectColumns(this._selectStr);
      this._columns = parsed.columns;
      this._embeds = parsed.embeds;
    }
    if (options?.count) this._countMode = options.count;
    if (options?.head) this._headOnly = true;
    return this;
  }

  // ── INSERT ──────────────────────────────────────────────────────────────

  insert(data: Record<string, unknown> | Record<string, unknown>[]): QueryBuilder<T> {
    this._operation = 'insert';
    this._insertData = data;
    return this;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────

  update(data: Record<string, unknown>): QueryBuilder<T> {
    this._operation = 'update';
    this._updateData = data;
    return this;
  }

  // ── DELETE ──────────────────────────────────────────────────────────────

  delete(): QueryBuilder<T> {
    this._operation = 'delete';
    return this;
  }

  // ── UPSERT ────────────────────────────────────────────────────────────

  upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ): QueryBuilder<T> {
    this._operation = 'upsert';
    this._insertData = data;
    this._upsertConflict = options?.onConflict ?? null;
    return this;
  }

  // ── FILTERS ─────────────────────────────────────────────────────────────

  eq(column: string, value: unknown): QueryBuilder<T> {
    // Check if this is an embed filter: "embed_table.column"
    const dotIdx = column.indexOf('.');
    if (dotIdx !== -1) {
      const embedName = column.slice(0, dotIdx);
      const embedCol = column.slice(dotIdx + 1);
      const embed = this._embeds.find((e) => e.relation === embedName);
      if (embed) {
        embed.filters.push({ column: embedCol, op: '=', value });
        return this;
      }
    }
    this._filters.push({ column, op: '=', value });
    return this;
  }

  neq(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, op: '!=', value });
    return this;
  }

  gt(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, op: '>', value });
    return this;
  }

  gte(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, op: '>=', value });
    return this;
  }

  lt(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, op: '<', value });
    return this;
  }

  lte(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, op: '<=', value });
    return this;
  }

  like(column: string, value: string): QueryBuilder<T> {
    this._filters.push({ column, op: 'like', value });
    return this;
  }

  ilike(column: string, value: string): QueryBuilder<T> {
    this._filters.push({ column, op: 'ilike', value });
    return this;
  }

  is(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, op: 'is', value });
    return this;
  }

  in(column: string, values: unknown[]): QueryBuilder<T> {
    this._filters.push({ column, op: 'in', value: values });
    return this;
  }

  not(column: string, op: string, value: unknown): QueryBuilder<T> {
    this._notFilters.push({ column, op, value });
    return this;
  }

  or(filterStr: string): QueryBuilder<T> {
    this._orFilters.push({ raw: filterStr });
    return this;
  }

  contains(column: string, value: unknown): QueryBuilder<T> {
    this._containsFilters.push({ column, value });
    return this;
  }

  textSearch(
    column: string,
    query: string,
    options?: { type?: 'plain' | 'websearch'; config?: string },
  ): QueryBuilder<T> {
    this._textSearchFilters.push({
      column,
      query,
      type: options?.type ?? 'plain',
      config: options?.config ?? 'english',
    });
    return this;
  }

  // ── MODIFIERS ─────────────────────────────────────────────────────────

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<T> {
    this._orderClauses.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this._limitCount = count;
    return this;
  }

  range(from: number, to: number): QueryBuilder<T> {
    this._offsetCount = from;
    this._limitCount = to - from + 1;
    return this;
  }

  single(): QueryBuilder<T> {
    this._returnSingle = true;
    this._limitCount = 1;
    return this;
  }

  maybeSingle(): QueryBuilder<T> {
    this._returnMaybeSingle = true;
    this._limitCount = 1;
    return this;
  }

  throwOnError(): QueryBuilder<T> {
    this._throwOnErr = true;
    return this;
  }

  // ── RPC (static, called via db.rpc()) ─────────────────────────────────

  // RPC is handled at the db proxy level, not here.

  // ── EXECUTE (then / await) ────────────────────────────────────────────

  async then<TResult1 = SupabaseResult<T>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this._execute();
      if (this._throwOnErr && result.error) {
        throw new Error(result.error.message);
      }
      return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  // ── SQL Generation & Execution ────────────────────────────────────────

  private async _execute(): Promise<SupabaseResult<T>> {
    const sql = getPool();
    const schema = getCurrentSchema();

    try {
      return await sql.begin(async (tx) => {
        // Set schema for this transaction
        await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);

        switch (this._operation) {
          case 'select':
            return this._executeSelect(tx);
          case 'insert':
            return this._executeInsert(tx);
          case 'update':
            return this._executeUpdate(tx);
          case 'delete':
            return this._executeDelete(tx);
          case 'upsert':
            return this._executeUpsert(tx);
          default:
            return { data: null, error: null, count: null };
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        data: null,
        error: { message, details: '', hint: '', code: 'PGRST000' },
        count: null,
      };
    }
  }

  private async _executeSelect(tx: postgres.TransactionSql): Promise<SupabaseResult<T>> {
    const where = this._buildWhere();
    const orderBy = this._buildOrderBy();
    const limit = this._limitCount !== null ? `LIMIT ${this._limitCount}` : '';
    const offset = this._offsetCount ? `OFFSET ${this._offsetCount}` : '';

    // Count query
    let count: number | null = null;
    if (this._countMode === 'exact') {
      const countSql = `SELECT count(*) as cnt FROM ${ident(this._table)} ${where}`;
      const countResult = await tx.unsafe(countSql);
      count = Number(countResult[0]?.cnt ?? 0);
    }

    if (this._headOnly) {
      return { data: null, error: null, count };
    }

    // Main query (without embeds for now)
    const cols = this._columns.includes('*')
      ? `${ident(this._table)}.*`
      : this._columns.map((c) => `${ident(this._table)}.${ident(c)}`).join(', ');

    const query = `SELECT ${cols} FROM ${ident(this._table)} ${where} ${orderBy} ${limit} ${offset}`;
    const rows = await tx.unsafe(query);

    let data: unknown = [...rows];

    // Handle foreign key embeds via separate queries
    if (this._embeds.length > 0 && Array.isArray(data) && (data as unknown[]).length > 0) {
      data = await this._resolveEmbeds(tx, data as Record<string, unknown>[]);
    }

    // Handle single/maybeSingle
    if (this._returnSingle) {
      if (Array.isArray(data) && (data as unknown[]).length === 0) {
        return {
          data: null,
          error: { message: 'Row not found', details: '', hint: '', code: 'PGRST116' },
          count,
        };
      }
      data = (data as unknown[])[0];
    } else if (this._returnMaybeSingle) {
      data = Array.isArray(data) ? ((data as unknown[])[0] ?? null) : data;
    }

    return { data: data as T, error: null, count };
  }

  private async _executeInsert(tx: postgres.TransactionSql): Promise<SupabaseResult<T>> {
    const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData!];
    if (rows.length === 0 || !rows[0]) {
      return { data: null, error: null, count: null };
    }

    const firstRow = rows[0]!;
    const columns = Object.keys(firstRow);
    const colStr = columns.map(ident).join(', ');
    const valuesStr = rows
      .map((row) => `(${columns.map((c) => this._paramValue(row[c])).join(', ')})`)
      .join(', ');

    const returning = this._returnSelect ? 'RETURNING *' : '';
    const query = `INSERT INTO ${ident(this._table)} (${colStr}) VALUES ${valuesStr} ${returning}`;
    const result = await tx.unsafe(query);

    let data: unknown = this._returnSelect ? [...result] : null;
    if (this._returnSingle && Array.isArray(data)) {
      data = (data as unknown[])[0] ?? null;
    } else if (this._returnMaybeSingle && Array.isArray(data)) {
      data = (data as unknown[])[0] ?? null;
    }

    return { data: data as T, error: null, count: null };
  }

  private async _executeUpdate(tx: postgres.TransactionSql): Promise<SupabaseResult<T>> {
    if (!this._updateData) {
      return { data: null, error: null, count: null };
    }

    const setClause = Object.entries(this._updateData)
      .map(([col, val]) => `${ident(col)} = ${this._paramValue(val)}`)
      .join(', ');

    const where = this._buildWhere();
    const returning = this._returnSelect ? 'RETURNING *' : '';
    const query = `UPDATE ${ident(this._table)} SET ${setClause} ${where} ${returning}`;
    const result = await tx.unsafe(query);

    let data: unknown = this._returnSelect ? [...result] : null;
    if (this._returnSingle && Array.isArray(data)) {
      data = (data as unknown[])[0] ?? null;
    } else if (this._returnMaybeSingle && Array.isArray(data)) {
      data = (data as unknown[])[0] ?? null;
    }

    return { data: data as T, error: null, count: null };
  }

  private async _executeDelete(tx: postgres.TransactionSql): Promise<SupabaseResult<T>> {
    const where = this._buildWhere();
    const returning = this._returnSelect ? 'RETURNING *' : '';
    const query = `DELETE FROM ${ident(this._table)} ${where} ${returning}`;
    const result = await tx.unsafe(query);

    let data: unknown = this._returnSelect ? [...result] : null;
    if (this._returnSingle && Array.isArray(data)) {
      data = (data as unknown[])[0] ?? null;
    }

    return { data: data as T, error: null, count: null };
  }

  private async _executeUpsert(tx: postgres.TransactionSql): Promise<SupabaseResult<T>> {
    const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData!];
    if (rows.length === 0 || !rows[0]) {
      return { data: null, error: null, count: null };
    }

    const firstRow = rows[0]!;
    const columns = Object.keys(firstRow);
    const colStr = columns.map(ident).join(', ');
    const valuesStr = rows
      .map((row) => `(${columns.map((c) => this._paramValue(row[c])).join(', ')})`)
      .join(', ');

    // Build ON CONFLICT clause
    const conflictCols = this._upsertConflict
      ? this._upsertConflict
          .split(',')
          .map((c) => ident(c.trim()))
          .join(', ')
      : columns.map(ident).join(', '); // fallback to all columns

    const updateCols = columns
      .filter(
        (c) =>
          !this._upsertConflict
            ?.split(',')
            .map((x) => x.trim())
            .includes(c),
      )
      .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`)
      .join(', ');

    const doUpdate = updateCols ? `DO UPDATE SET ${updateCols}` : 'DO NOTHING';
    const query =
      `INSERT INTO ${ident(this._table)} (${colStr}) VALUES ${valuesStr} ` +
      `ON CONFLICT (${conflictCols}) ${doUpdate} RETURNING *`;

    const result = await tx.unsafe(query);
    let data: unknown = [...result];

    if (this._returnSingle && Array.isArray(data)) {
      data = (data as unknown[])[0] ?? null;
    } else if (this._returnMaybeSingle && Array.isArray(data)) {
      data = (data as unknown[])[0] ?? null;
    }

    return { data: data as T, error: null, count: null };
  }

  // ── Embed resolution ──────────────────────────────────────────────────

  private async _resolveEmbeds(
    tx: postgres.TransactionSql,
    rows: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    for (const embed of this._embeds) {
      // Detect FK: look for <relation>_id or id column matching
      const fkColumn = `${embed.relation.replace(/s$/, '')}_id`;
      const hasFk = rows[0] ? fkColumn in rows[0] : false;
      // Also check if the table has a FK pointing to the embed
      const reverseFk = `${this._table.replace(/s$/, '')}_id`;

      if (hasFk) {
        // Forward FK: this table has <relation>_id
        const ids = [...new Set(rows.map((r) => r[fkColumn]).filter(Boolean))];
        if (ids.length === 0) {
          for (const row of rows) {
            const key = embed.alias || embed.relation;
            row[key] = null;
          }
          continue;
        }

        const embedCols = embed.columns.includes('*')
          ? '*'
          : ['id', ...embed.columns].map(ident).join(', ');

        let embedWhere = `WHERE "id" IN (${ids.map(escapeValue).join(', ')})`;
        for (const f of embed.filters) {
          embedWhere += ` AND ${ident(f.column)} ${f.op} ${this._paramValue(f.value)}`;
        }

        const embedRows = await tx.unsafe(
          `SELECT ${embedCols} FROM ${ident(embed.relation)} ${embedWhere}`,
        );
        const embedMap = new Map(embedRows.map((r: Record<string, unknown>) => [String(r.id), r]));

        for (const row of rows) {
          const key = embed.alias || embed.relation;
          const related = embedMap.get(String(row[fkColumn])) ?? null;
          if (embed.modifier === 'inner' && !related) {
            // Inner join: skip rows without match
            continue;
          }
          row[key] = related;
        }
      } else {
        // Reverse FK: embed table has <this_table>_id pointing back
        const parentIds = [...new Set(rows.map((r) => r.id).filter(Boolean))];
        if (parentIds.length === 0) continue;

        const embedCols = embed.columns.includes('*')
          ? '*'
          : [reverseFk, ...embed.columns].map(ident).join(', ');

        let embedWhere = `WHERE ${ident(reverseFk)} IN (${parentIds.map(escapeValue).join(', ')})`;
        for (const f of embed.filters) {
          embedWhere += ` AND ${ident(f.column)} ${f.op} ${this._paramValue(f.value)}`;
        }

        const embedRows = await tx.unsafe(
          `SELECT ${embedCols} FROM ${ident(embed.relation)} ${embedWhere}`,
        );

        // Group by parent FK
        const grouped = new Map<string, Record<string, unknown>[]>();
        for (const er of embedRows) {
          const parentId = String((er as Record<string, unknown>)[reverseFk]);
          if (!grouped.has(parentId)) grouped.set(parentId, []);
          grouped.get(parentId)!.push(er as Record<string, unknown>);
        }

        for (const row of rows) {
          const key = embed.alias || embed.relation;
          row[key] = grouped.get(String(row.id)) ?? [];
        }
      }
    }

    // Filter out rows that failed inner join
    if (this._embeds.some((e) => e.modifier === 'inner')) {
      return rows.filter((row) => {
        return this._embeds
          .filter((e) => e.modifier === 'inner')
          .every((e) => {
            const key = e.alias || e.relation;
            return row[key] !== null && row[key] !== undefined;
          });
      });
    }

    return rows;
  }

  // ── SQL Helpers ───────────────────────────────────────────────────────

  private _buildWhere(): string {
    const conditions: string[] = [];

    for (const f of this._filters) {
      if (f.op === 'is') {
        const isNull = f.value === null || f.value === 'null';
        conditions.push(`${ident(f.column)} IS ${isNull ? 'NULL' : 'NOT NULL'}`);
      } else if (f.op === 'in') {
        const vals = (f.value as unknown[]).map(escapeValue).join(', ');
        conditions.push(`${ident(f.column)} IN (${vals})`);
      } else if (f.op === 'ilike') {
        conditions.push(`${ident(f.column)} ILIKE ${escapeValue(f.value)}`);
      } else if (f.op === 'like') {
        conditions.push(`${ident(f.column)} LIKE ${escapeValue(f.value)}`);
      } else {
        conditions.push(`${ident(f.column)} ${f.op} ${this._paramValue(f.value)}`);
      }
    }

    for (const nf of this._notFilters) {
      if (nf.op === 'is') {
        const isNull = nf.value === null || nf.value === 'null';
        conditions.push(`${ident(nf.column)} IS ${isNull ? 'NOT NULL' : 'NULL'}`);
      } else {
        conditions.push(`NOT (${ident(nf.column)} ${nf.op} ${this._paramValue(nf.value)})`);
      }
    }

    for (const cf of this._containsFilters) {
      conditions.push(`${ident(cf.column)} @> ${this._paramValue(cf.value)}::jsonb`);
    }

    for (const orF of this._orFilters) {
      conditions.push(parseOrConditions(orF.raw));
    }

    const ALLOWED_TS_CONFIGS = new Set(['simple', 'english', 'portuguese', 'spanish', 'french', 'german', 'italian']);
    for (const ts of this._textSearchFilters) {
      const safeConfig = ALLOWED_TS_CONFIGS.has(ts.config) ? ts.config : 'simple';
      const fn = ts.type === 'websearch' ? 'websearch_to_tsquery' : 'plainto_tsquery';
      // Handle multi-column text search: "col1, col2" → to_tsvector concat
      if (ts.column.includes(',')) {
        const cols = ts.column.split(',').map((c) => `coalesce(${ident(c.trim())}, '')`);
        conditions.push(
          `to_tsvector('${safeConfig}', ${cols.join(" || ' ' || ")}) @@ ${fn}('${safeConfig}', ${escapeValue(ts.query)})`,
        );
      } else {
        // Single column — might be a tsvector column already (like search_vector)
        conditions.push(`${ident(ts.column)} @@ ${fn}('${safeConfig}', ${escapeValue(ts.query)})`);
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  private _buildOrderBy(): string {
    if (this._orderClauses.length === 0) return '';
    const clauses = this._orderClauses.map((o) => {
      const dir = o.ascending ? 'ASC' : 'DESC';
      const nulls = o.nullsFirst !== undefined ? (o.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST') : '';
      return `${ident(o.column)} ${dir} ${nulls}`.trim();
    });
    return `ORDER BY ${clauses.join(', ')}`;
  }

  private _paramValue(val: unknown): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return escapeValue(val.toISOString());
    if (Array.isArray(val)) return `'${JSON.stringify(val)}'::jsonb`;
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    return escapeValue(val);
  }
}

// ── RPC Executor ────────────────────────────────────────────────────────────

async function executeRpc<T = unknown>(
  functionName: string,
  params?: Record<string, unknown>,
): Promise<SupabaseResult<T>> {
  const sql = getPool();
  const schema = getCurrentSchema();

  try {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);

      if (!params || Object.keys(params).length === 0) {
        return tx.unsafe(`SELECT * FROM ${ident(functionName)}()`);
      }

      const paramEntries = Object.entries(params);
      const paramStr = paramEntries
        .map(([key, val]) => {
          if (val === null || val === undefined) return `${key} := NULL`;
          if (typeof val === 'number') return `${key} := ${val}`;
          if (typeof val === 'boolean') return `${key} := ${val}`;
          if (typeof val === 'string') {
            // Check if it looks like a vector array
            if (val.startsWith('[') && val.includes(',')) {
              return `${key} := '${val}'::vector`;
            }
            return `${key} := '${val.replace(/'/g, "''")}'`;
          }
          if (Array.isArray(val)) {
            // Vector embedding array
            return `${key} := '[${val.join(',')}]'::vector`;
          }
          return `${key} := '${JSON.stringify(val).replace(/'/g, "''")}'`;
        })
        .join(', ');

      return tx.unsafe(`SELECT * FROM ${ident(functionName)}(${paramStr})`);
    });

    const data = result.length === 1 ? result[0] : [...result];
    return { data: data as T, error: null, count: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: { message, details: '', hint: '', code: 'PGRST000' },
      count: null,
    };
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface SupabaseCompatClient {
  // biome-ignore lint/suspicious/noExplicitAny: Matches Supabase's dynamic typing
  from: <T = any>(table: string) => QueryBuilder<T>;
  // biome-ignore lint/suspicious/noExplicitAny: Matches Supabase's dynamic typing
  rpc: <T = any>(fn: string, params?: Record<string, unknown>) => Promise<SupabaseResult<T>>;
}

export function createCompatClient(): SupabaseCompatClient {
  return {
    from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
      return new QueryBuilder<T>(table);
    },
    rpc<T = unknown>(fn: string, params?: Record<string, unknown>): Promise<SupabaseResult<T>> {
      return executeRpc<T>(fn, params);
    },
  };
}
