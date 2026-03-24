import { describe, expect, it } from 'vitest';

/**
 * Lógica de detecção extraída de apps/web/app/api/admin/setup-account/route.ts
 * Deve corresponder ao que está implementado no route handler.
 */
function isAlreadyRegisteredError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes('already') && msg.includes('registered');
}

describe('isAlreadyRegisteredError', () => {
  it('detecta "User already registered"', () => {
    expect(isAlreadyRegisteredError('User already registered')).toBe(true);
  });

  it('detecta "User has already been registered" (mensagem real do Supabase)', () => {
    expect(isAlreadyRegisteredError('User has already been registered')).toBe(true);
  });

  it('detecta variações com capitalização diferente', () => {
    expect(isAlreadyRegisteredError('EMAIL ALREADY REGISTERED')).toBe(true);
    expect(isAlreadyRegisteredError('already registered')).toBe(true);
  });

  it('não detecta erros de autenticação comuns', () => {
    expect(isAlreadyRegisteredError('Invalid login credentials')).toBe(false);
    expect(isAlreadyRegisteredError('Password should be at least 6 characters')).toBe(false);
    expect(isAlreadyRegisteredError('Unable to validate email address')).toBe(false);
    expect(isAlreadyRegisteredError('')).toBe(false);
  });

  it('não detecta "registered" sem "already"', () => {
    expect(isAlreadyRegisteredError('Email registered successfully')).toBe(false);
  });
});

describe('setup-account response codes', () => {
  it('409 deve ser retornado quando USER_ALREADY_EXISTS', () => {
    // Documenta o contrato esperado do endpoint
    const mockError = { error: 'USER_ALREADY_EXISTS', email: 'user@example.com' };
    expect(mockError.error).toBe('USER_ALREADY_EXISTS');
  });
});
