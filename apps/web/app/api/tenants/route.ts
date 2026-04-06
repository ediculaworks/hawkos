import { getAllTenants } from '@/lib/tenants/cache';
import { verifyToken } from '@hawk/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('hawk_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const tenants = await getAllTenants();
  return NextResponse.json({ tenants });
}
