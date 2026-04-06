import { getSafeSchemaFromCookie } from '@/lib/auth/safe-schema';
import { verifyToken } from '@hawk/auth';
import { scopedTransaction } from '@hawk/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('hawk_session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const tenantInfo = await getSafeSchemaFromCookie();
    if (!tenantInfo) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rows = await scopedTransaction(tenantInfo.schemaName, (tx) =>
      tx.unsafe('SELECT name, onboarding_complete FROM profile LIMIT 1'),
    );

    const profile = rows[0] as { name: string; onboarding_complete: boolean } | undefined;

    return NextResponse.json({
      email: payload.email,
      role: payload.role,
      tenant: payload.tenant,
      onboardingComplete: profile?.onboarding_complete ?? false,
      name: profile?.name ?? null,
    });
  } catch (err) {
    console.error('[api/auth/me]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
