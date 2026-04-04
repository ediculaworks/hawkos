import { type HawkJwtPayload, verifyToken } from "@hawk/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getSession(): Promise<HawkJwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('hawk_session')?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  return payload;
}

export async function requireAuth(): Promise<HawkJwtPayload> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireAdmin(): Promise<HawkJwtPayload> {
  const session = await requireAuth();
  if (session.role !== 'admin') redirect('/dashboard');
  return session;
}

export async function getTenantSlug(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('hawk_tenant')?.value ?? null;
  } catch {
    return null;
  }
}
