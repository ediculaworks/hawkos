import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('hawk_session');
  cookieStore.delete('hawk_tenant');
  cookieStore.delete('hawk_onboarding');
  return NextResponse.json({ success: true });
}
