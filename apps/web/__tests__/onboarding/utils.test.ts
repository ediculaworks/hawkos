import { describe, expect, it } from 'vitest';
import { extractProjectRef } from '../../lib/onboarding/utils';

describe('extractProjectRef', () => {
  it('extrai ref de URL válida', () => {
    expect(extractProjectRef('https://abcdef123.supabase.co')).toBe('abcdef123');
  });

  it('extrai ref com URL real do Hawk OS', () => {
    expect(extractProjectRef('https://wmiocwbigobhlapiblwb.supabase.co')).toBe(
      'wmiocwbigobhlapiblwb',
    );
  });

  it('extrai ref case-insensitive', () => {
    expect(extractProjectRef('https://ABCDEF.supabase.co')).toBe('ABCDEF');
  });

  it('retorna null para URL de outro host', () => {
    expect(extractProjectRef('https://postgres.example.com')).toBeNull();
  });

  it('retorna null para string vazia', () => {
    expect(extractProjectRef('')).toBeNull();
  });

  it('retorna null para string que não é URL', () => {
    expect(extractProjectRef('not-a-url')).toBeNull();
  });

  it('retorna null para supabase.co sem subdomínio', () => {
    expect(extractProjectRef('https://supabase.co')).toBeNull();
  });

  it('extrai ref ignorando path e query string', () => {
    expect(extractProjectRef('https://myproject.supabase.co/rest/v1/table?select=*')).toBe(
      'myproject',
    );
  });
});
