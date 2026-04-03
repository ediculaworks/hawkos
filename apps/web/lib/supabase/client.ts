// Browser-side client — no longer uses Supabase.
// This file is kept for backwards compatibility but the browser
// no longer needs a direct database client. All data goes through
// Server Actions (which use withTenant) or API routes.

export function createClient() {
  console.warn(
    '[supabase/client] createClient() is deprecated. Use Server Actions or API routes instead.',
  );
  return {
    auth: {
      signOut: async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        return { error: null };
      },
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({
        data: null,
        error: { message: 'Use /api/auth/login instead' },
      }),
    },
    from: () => {
      throw new Error('Browser-side DB access is no longer supported. Use Server Actions.');
    },
  };
}
