import { getAllTenants } from '@/lib/tenants/cache';
import { NextResponse } from 'next/server';

export async function GET() {
  const tenants = await getAllTenants();
  return NextResponse.json({ tenants });
}
