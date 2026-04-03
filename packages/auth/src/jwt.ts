import { type JWTPayload, SignJWT, jwtVerify } from 'jose';

export interface HawkJwtPayload extends JWTPayload {
  sub: string; // user UUID
  email: string;
  role: string;
  tenant: string; // tenant slug
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

const ISSUER = 'hawk-os';
const AUDIENCE = 'hawk-os';
const EXPIRATION = '24h';

/** Sign a JWT for a user session. */
export async function signToken(payload: {
  userId: string;
  email: string;
  role: string;
  tenant: string;
}): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    tenant: payload.tenant,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret());
}

/** Verify and decode a JWT. Returns the payload or null if invalid. */
export async function verifyToken(token: string): Promise<HawkJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload as HawkJwtPayload;
  } catch {
    return null;
  }
}
