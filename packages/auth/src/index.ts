import { getPool } from '@hawk/db';
import { type HawkJwtPayload, signToken, verifyToken } from './jwt.ts';
import { hashPassword, verifyPassword } from './passwords.ts';

export { hashPassword, verifyPassword } from './passwords.ts';
export { signToken, verifyToken, type HawkJwtPayload } from './jwt.ts';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface AuthResult<T = unknown> {
  data: T | null;
  error: string | null;
}

// ── Auth Service ────────────────────────────────────────────────────────────

/**
 * Sign in with email and password.
 * Returns a JWT token on success.
 */
export async function signIn(
  email: string,
  password: string,
  tenantSlug: string,
  schemaName: string,
): Promise<AuthResult<{ token: string; user: AuthUser }>> {
  const sql = getPool();

  const rows = await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
    return tx.unsafe(
      `SELECT id, email, password_hash, role, created_at, updated_at
       FROM auth_users WHERE email = $1 LIMIT 1`,
      [email],
    );
  });

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return { data: null, error: 'Invalid email or password' };
  }

  const valid = verifyPassword(password, row.password_hash as string);
  if (!valid) {
    return { data: null, error: 'Invalid email or password' };
  }

  const token = await signToken({
    userId: row.id as string,
    email: row.email as string,
    role: row.role as string,
    tenant: tenantSlug,
  });

  return {
    data: {
      token,
      user: {
        id: row.id as string,
        email: row.email as string,
        role: row.role as string,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      },
    },
    error: null,
  };
}

/**
 * Get user from JWT token.
 * Returns the decoded user info or null.
 */
export async function getUser(token: string): Promise<AuthResult<HawkJwtPayload>> {
  const payload = await verifyToken(token);
  if (!payload) {
    return { data: null, error: 'Invalid or expired token' };
  }
  return { data: payload, error: null };
}

/**
 * Create a new user in the specified tenant schema.
 */
export async function createUser(
  email: string,
  password: string,
  schemaName: string,
  role = 'user',
): Promise<AuthResult<AuthUser>> {
  const sql = getPool();
  const passwordHash = hashPassword(password);

  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
      return tx.unsafe(
        `INSERT INTO auth_users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, role, created_at, updated_at`,
        [email, passwordHash, role],
      );
    });

    const row = rows[0] as Record<string, unknown>;
    return {
      data: {
        id: row.id as string,
        email: row.email as string,
        role: row.role as string,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('duplicate') || message.includes('unique')) {
      return { data: null, error: 'Email already exists' };
    }
    return { data: null, error: message };
  }
}

/**
 * List all users in a tenant schema.
 */
export async function listUsers(schemaName: string): Promise<AuthResult<AuthUser[]>> {
  const sql = getPool();
  const rows = await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
    return tx.unsafe(
      'SELECT id, email, role, created_at, updated_at FROM auth_users ORDER BY created_at',
    );
  });

  return {
    data: (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      email: r.email as string,
      role: r.role as string,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    })),
    error: null,
  };
}

/**
 * Update a user by ID.
 */
export async function updateUser(
  userId: string,
  updates: { email?: string; password?: string; role?: string },
  schemaName: string,
): Promise<AuthResult<AuthUser>> {
  const sql = getPool();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (updates.email) {
    setClauses.push(`email = $${paramIdx++}`);
    values.push(updates.email);
  }
  if (updates.password) {
    setClauses.push(`password_hash = $${paramIdx++}`);
    values.push(hashPassword(updates.password));
  }
  if (updates.role) {
    setClauses.push(`role = $${paramIdx++}`);
    values.push(updates.role);
  }

  if (setClauses.length === 0) {
    return { data: null, error: 'No fields to update' };
  }

  setClauses.push('updated_at = now()');
  values.push(userId);

  const rows = await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
    return tx.unsafe(
      `UPDATE auth_users SET ${setClauses.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, email, role, created_at, updated_at`,
      values as (string | number | boolean | null)[],
    );
  });

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return { data: null, error: 'User not found' };
  }

  return {
    data: {
      id: row.id as string,
      email: row.email as string,
      role: row.role as string,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    },
    error: null,
  };
}

/**
 * Delete a user by ID.
 */
export async function deleteUser(
  userId: string,
  schemaName: string,
): Promise<AuthResult<{ deleted: boolean }>> {
  const sql = getPool();

  const result = await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
    return tx.unsafe('DELETE FROM auth_users WHERE id = $1', [userId]);
  });

  return {
    data: { deleted: result.count > 0 },
    error: null,
  };
}
