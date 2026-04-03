import { hashSync, verifySync } from '@node-rs/bcrypt';

const BCRYPT_ROUNDS = 12;

/** Hash a plaintext password with bcrypt. */
export function hashPassword(password: string): string {
  return hashSync(password, BCRYPT_ROUNDS);
}

/** Verify a plaintext password against a bcrypt hash. */
export function verifyPassword(password: string, hash: string): boolean {
  return verifySync(password, hash);
}
