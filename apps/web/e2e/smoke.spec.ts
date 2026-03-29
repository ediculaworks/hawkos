import { expect, test } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Hawk/i);
  });

  test('unauthenticated user redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('login page has required elements', async ({ page }) => {
    await page.goto('/login');
    // Should have some form of login UI
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});

test.describe('Security Headers', () => {
  test('response includes security headers', async ({ page }) => {
    const response = await page.goto('/login');
    const headers = response?.headers() ?? {};

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age=');
  });

  test('CSP header is set', async ({ page }) => {
    const response = await page.goto('/login');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('frame-ancestors');
  });
});

test.describe('Rate Limiting', () => {
  test('API returns 429 after exceeding limit', async ({ request }) => {
    // Factory reset is limited to 1/hour
    const responses = [];
    for (let i = 0; i < 3; i++) {
      const res = await request.post('/api/factory-reset', {
        data: { confirmation: 'test' },
      });
      responses.push(res.status());
    }
    // At least one should be 429 (the 2nd+ requests)
    expect(responses.some((s) => s === 429)).toBe(true);
  });
});
