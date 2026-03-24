import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

/**
 * Tests for credential-manager.ts encrypt/decrypt logic.
 * Tests the pure crypto functions without requiring Supabase connection.
 */

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const IV_LENGTH = 16;
const SALT = 'hawk-os-admin-salt-v1';

function deriveKey(masterKey: string): Buffer {
  return createHash('sha256')
    .update(masterKey + SALT)
    .digest();
}

function encrypt(text: string, masterKey: string): { encrypted: string; iv: string } {
  const key = deriveKey(masterKey);
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

function decryptCorrect(encryptedData: string, iv: string, masterKey: string): string {
  const { createDecipheriv } = require('node:crypto');
  const key = deriveKey(masterKey);
  const ivBuffer = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');
  const encryptedBuf = combined.slice(0, -TAG_LENGTH);
  const tag = combined.slice(-TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedBuf, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

describe('Credential Manager Crypto', () => {
  const MASTER_KEY = 'test-master-key-for-unit-tests-only';

  it('should encrypt and decrypt a string roundtrip', () => {
    const original = 'my-secret-service-role-key';
    const { encrypted, iv } = encrypt(original, MASTER_KEY);

    expect(encrypted).toBeTruthy();
    expect(iv).toBeTruthy();
    expect(encrypted).not.toBe(original);

    const decrypted = decryptCorrect(encrypted, iv, MASTER_KEY);
    expect(decrypted).toBe(original);
  });

  it('should encrypt and decrypt JSON roundtrip', () => {
    const original = { bot_token: 'MTIzNDU2Nzg5.abc', guild_id: '123456' };
    const json = JSON.stringify(original);
    const { encrypted, iv } = encrypt(json, MASTER_KEY);

    const decrypted = decryptCorrect(encrypted, iv, MASTER_KEY);
    expect(JSON.parse(decrypted)).toEqual(original);
  });

  it('should fail to decrypt with wrong master key', () => {
    const { encrypted, iv } = encrypt('secret', MASTER_KEY);

    expect(() => {
      decryptCorrect(encrypted, iv, 'wrong-master-key');
    }).toThrow();
  });

  it('should fail to decrypt with corrupted data', () => {
    const { encrypted, iv } = encrypt('secret', MASTER_KEY);
    const corrupted = `${encrypted.slice(0, -4)}AAAA`;

    expect(() => {
      decryptCorrect(corrupted, iv, MASTER_KEY);
    }).toThrow();
  });

  it('should produce different ciphertexts for same plaintext (random IV)', () => {
    const plaintext = 'same-input';
    const result1 = encrypt(plaintext, MASTER_KEY);
    const result2 = encrypt(plaintext, MASTER_KEY);

    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);

    // But both should decrypt to the same value
    expect(decryptCorrect(result1.encrypted, result1.iv, MASTER_KEY)).toBe(plaintext);
    expect(decryptCorrect(result2.encrypted, result2.iv, MASTER_KEY)).toBe(plaintext);
  });

  it('should handle empty string', () => {
    const { encrypted, iv } = encrypt('', MASTER_KEY);
    const decrypted = decryptCorrect(encrypted, iv, MASTER_KEY);
    expect(decrypted).toBe('');
  });

  it('should handle unicode text', () => {
    const original = 'Olá mundo! 🦅 Hawk OS — données secrètes';
    const { encrypted, iv } = encrypt(original, MASTER_KEY);
    const decrypted = decryptCorrect(encrypted, iv, MASTER_KEY);
    expect(decrypted).toBe(original);
  });
});
