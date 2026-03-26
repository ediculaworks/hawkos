import { createDecipheriv, createHash } from 'node:crypto';
import { requireAdminAuth } from '@/lib/admin-auth';
import { extractProjectRef } from '@/lib/onboarding/utils';
import { invalidateTenantCache } from '@/lib/tenants/cache';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const SALT = 'hawk-os-admin-salt-v1';

interface RepairRequest {
  tenantSlug: string;
  action: 'reset-user' | 're-migrate';
  email?: string;
  newPassword?: string;
  supabaseAccessToken?: string;
}

function deriveKey(masterKey: string): Buffer {
  return createHash('sha256')
    .update(masterKey + SALT)
    .digest();
}

function decryptServiceKey(encryptedData: string, iv: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const ivBuffer = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');
  const encrypted = combined.slice(0, -TAG_LENGTH);
  const tag = combined.slice(-TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getAdminClient() {
  const url = process.env.ADMIN_SUPABASE_URL;
  const key = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Admin Supabase not configured');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body: RepairRequest = await request.json();
    const { tenantSlug, action, email, newPassword, supabaseAccessToken } = body;

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug required' }, { status: 400 });
    }

    if (action === 'reset-user') {
      return handleResetUser(tenantSlug, email, newPassword);
    }

    if (action === 're-migrate') {
      return handleReMigrate(tenantSlug, supabaseAccessToken);
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

async function handleResetUser(
  tenantSlug: string,
  email?: string,
  newPassword?: string,
): Promise<NextResponse> {
  if (!email || !newPassword) {
    return NextResponse.json({ error: 'email and newPassword required' }, { status: 400 });
  }

  const admin = getAdminClient();
  const masterKey = process.env.ADMIN_SUPABASE_SERVICE_KEY || '';

  // Fetch tenant and decrypt service key
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('supabase_url, supabase_service_key_encrypted, supabase_service_key_iv')
    .eq('slug', tenantSlug)
    .eq('status', 'active')
    .maybeSingle();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const serviceKey = decryptServiceKey(
    tenant.supabase_service_key_encrypted,
    tenant.supabase_service_key_iv,
    masterKey,
  );

  // Create client for tenant's Supabase
  const tenantClient = createClient(tenant.supabase_url, serviceKey, {
    auth: { persistSession: false },
  });

  // Look up user
  const { data: users, error: listError } = await tenantClient.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const existingUser = users?.users.find((u) => u.email === email);

  if (existingUser) {
    // Update password
    const { error: updateError } = await tenantClient.auth.admin.updateUserById(existingUser.id, {
      password: newPassword,
      email_confirm: true,
    });
    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }
    return NextResponse.json({
      success: true,
      action: 'updated',
      message: `Password reset for ${email}`,
    });
  } else {
    // Create new user
    const { data: newUser, error: createError } = await tenantClient.auth.admin.createUser({
      email,
      password: newPassword,
      email_confirm: true,
    });
    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }
    return NextResponse.json({
      success: true,
      action: 'created',
      userId: newUser?.user?.id,
      message: `User created: ${email}`,
    });
  }
}

async function handleReMigrate(
  tenantSlug: string,
  supabaseAccessToken?: string,
): Promise<NextResponse> {
  if (!supabaseAccessToken) {
    return NextResponse.json(
      { error: 'supabaseAccessToken required for re-migration' },
      { status: 400 },
    );
  }

  const admin = getAdminClient();

  // Fetch tenant URL
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('supabase_url')
    .eq('slug', tenantSlug)
    .eq('status', 'active')
    .maybeSingle();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Extract project ref
  const projectRef = extractProjectRef(tenant.supabase_url);
  if (!projectRef) {
    return NextResponse.json({ error: 'Invalid Supabase URL' }, { status: 400 });
  }

  // Call apply-migrations internally with streaming response
  try {
    const migrateRes = await fetch(
      new URL('/api/admin/apply-migrations', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': process.env.ADMIN_SUPABASE_SERVICE_KEY || '',
        },
        body: JSON.stringify({
          projectRef,
          target: 'tenant',
          tenantAccessToken: supabaseAccessToken,
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
    throw new Error(`Failed to call apply-migrations: ${error instanceof Error ? error.message : String(error)}`);
  }
}
