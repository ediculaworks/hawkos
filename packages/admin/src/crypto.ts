import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const LEGACY_SALT = 'hawk-os-admin-salt-v1';

function deriveKey(masterKey: string, salt?: string | null): Buffer {
  return createHash('sha256')
    .update(masterKey + (salt || LEGACY_SALT))
    .digest();
}

export function encrypt(
  text: string,
  masterKey: string,
  salt?: string | null,
): { encrypted: string; iv: string } {
  const key = deriveKey(masterKey, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), tag]);

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decrypt(
  encryptedData: string,
  iv: string,
  masterKey: string,
  salt?: string | null,
): string {
  const key = deriveKey(masterKey, salt);
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

export function generateAgentSecret(): string {
  return randomBytes(32).toString('hex');
}

export function generateSlug(base: string): string {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');
}
