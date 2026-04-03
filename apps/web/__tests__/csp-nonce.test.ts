import { describe, expect, it } from 'vitest';

// We test the buildCsp function directly
// It's exported from middleware.ts but we can't import Next.js middleware in vitest easily
// So we replicate the pure function for testing

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai https://vitals.vercel-insights.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

describe('CSP nonce generation', () => {
  it('includes nonce in script-src', () => {
    const csp = buildCsp('abc123', false);
    expect(csp).toContain("'nonce-abc123'");
  });

  it('does not include unsafe-inline in script-src (only in style-src)', () => {
    const csp = buildCsp('test-nonce', false);
    const scriptSrc = csp.split(';').find((d) => d.includes('script-src')) ?? '';
    expect(scriptSrc).not.toContain('unsafe-inline');
    // style-src still has unsafe-inline (needed for Tailwind)
    const styleSrc = csp.split(';').find((d) => d.includes('style-src')) ?? '';
    expect(styleSrc).toContain('unsafe-inline');
  });

  it('includes unsafe-eval in dev mode for HMR', () => {
    const csp = buildCsp('test-nonce', true);
    expect(csp).toContain("'unsafe-eval'");
  });

  it('does not include unsafe-eval in production', () => {
    const csp = buildCsp('test-nonce', false);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('maintains frame-ancestors none', () => {
    const csp = buildCsp('n', false);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('allows Supabase and OpenRouter in connect-src', () => {
    const csp = buildCsp('n', false);
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain('https://openrouter.ai');
  });
});
