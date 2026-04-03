import { requireAdminAuth } from '@/lib/admin-auth';
import { createAdminClientFromEnv } from '@hawk/admin';
import { createUser, listUsers, updateUser } from '@hawk/auth';
import { getPool } from '@hawk/db';
import { NextResponse } from 'next/server';

interface RepairRequest {
  tenantSlug: string;
  action: 'reset-user' | 're-migrate' | 'fix-profile';
  email?: string;
  newPassword?: string;
  name?: string;
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body: RepairRequest = await request.json();
    const { tenantSlug, action, email, newPassword, name } = body;

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug required' }, { status: 400 });
    }

    if (action === 'reset-user') {
      return handleResetUser(tenantSlug, email, newPassword);
    }

    if (action === 're-migrate') {
      return handleReMigrate(tenantSlug);
    }

    if (action === 'fix-profile') {
      return handleFixProfile(tenantSlug, email, name);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[admin/repair-tenant] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Repair failed' },
      { status: 500 },
    );
  }
}

async function getTenantSchema(tenantSlug: string): Promise<string> {
  const admin = createAdminClientFromEnv();
  const tenant = await admin.getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Tenant not found');
  return tenant.schema_name;
}

async function handleResetUser(
  tenantSlug: string,
  email?: string,
  newPassword?: string,
): Promise<NextResponse> {
  if (!email || !newPassword) {
    return NextResponse.json({ error: 'email and newPassword required' }, { status: 400 });
  }

  const schemaName = await getTenantSchema(tenantSlug);

  // Look up user
  const { data: users, error: listError } = await listUsers(schemaName);
  if (listError) {
    throw new Error(`Failed to list users: ${listError}`);
  }

  const existingUser = users?.find((u) => u.email === email);

  if (existingUser) {
    // Update password
    const { error: updateError } = await updateUser(
      existingUser.id,
      { password: newPassword },
      schemaName,
    );
    if (updateError) {
      throw new Error(`Failed to update user: ${updateError}`);
    }
    return NextResponse.json({
      success: true,
      action: 'updated',
      message: `Password reset for ${email}`,
    });
  }

  // Create new user
  const { data: newUser, error: createError } = await createUser(email, newPassword, schemaName);
  if (createError) {
    throw new Error(`Failed to create user: ${createError}`);
  }
  return NextResponse.json({
    success: true,
    action: 'created',
    userId: newUser?.id,
    message: `User created: ${email}`,
  });
}

async function handleReMigrate(tenantSlug: string): Promise<NextResponse> {
  // Call apply-migrations internally
  try {
    const migrateRes = await fetch(
      new URL(
        '/api/admin/apply-migrations',
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': process.env.ADMIN_MASTER_KEY || process.env.JWT_SECRET || '',
        },
        body: JSON.stringify({
          target: 'tenant',
          tenantSlug,
        }),
      },
    );

    if (!migrateRes.ok) {
      const errorBody = await migrateRes.text();
      throw new Error(`Migration failed: ${migrateRes.status} - ${errorBody}`);
    }

    // Return streaming response (NDJSON)
    return new NextResponse(migrateRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to call apply-migrations: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleFixProfile(
  tenantSlug: string,
  email?: string,
  name?: string,
): Promise<NextResponse> {
  if (!email) {
    return NextResponse.json({ error: 'email required for fix-profile' }, { status: 400 });
  }

  const schemaName = await getTenantSchema(tenantSlug);

  // Look up user
  const { data: users, error: listError } = await listUsers(schemaName);
  if (listError) {
    throw new Error(`Failed to list users: ${listError}`);
  }

  const user = users?.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json({ error: `User ${email} not found` }, { status: 404 });
  }

  // Create or update profile
  const sql = getPool();
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
    await tx.unsafe(
      `INSERT INTO profile (id, name, onboarding_complete)
       VALUES ($1, $2, true)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         onboarding_complete = true`,
      [user.id, (name ?? email.split('@')[0]) as string],
    );
  });

  return NextResponse.json({
    success: true,
    message: `Profile fixed for ${email} - onboarding_complete set to true`,
  });
}
