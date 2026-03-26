import { TenantRepairActions } from '@/components/admin/tenant-repair-actions';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

function getAdminClient() {
  const url = process.env.ADMIN_SUPABASE_URL;
  const key = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Admin Supabase not configured');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getTenants() {
  const supabase = getAdminClient();

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*, tenant_modules(count), tenant_metrics(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (tenants || []).map((t) => ({
    ...t,
    supabase_service_key_encrypted: undefined,
    supabase_service_key_iv: undefined,
  }));
}

async function getSlots() {
  const supabase = getAdminClient();

  const { data: slots } = await supabase
    .from('tenant_availability')
    .select('*')
    .order('slot_number');

  return slots || [];
}

export default async function AdminPage() {
  const supabase = getAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin');
  }

  try {
    const [tenants, slots] = await Promise.all([getTenants(), getSlots()]);

    const activeTenants = tenants.filter((t) => t.status === 'active');
    const totalTokens = tenants.reduce((acc, t) => {
      const todayMetrics = t.tenant_metrics?.find(
        (m: { date: string }) => m.date === new Date().toISOString().split('T')[0],
      );
      return acc + (todayMetrics?.tokens_used || 0);
    }, 0);

    return (
      <div className="min-h-screen bg-[var(--color-surface-0)] p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                Admin Dashboard
              </h1>
              <p className="text-[var(--color-text-muted)]">Hawk OS Platform Management</p>
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Logged in as: {user.email}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
              <div className="text-3xl font-bold text-[var(--color-accent)]">{tenants.length}</div>
              <div className="text-sm text-[var(--color-text-muted)]">Total Tenants</div>
            </div>
            <div className="p-6 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
              <div className="text-3xl font-bold text-[var(--color-success)]">
                {activeTenants.length}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">Active</div>
            </div>
            <div className="p-6 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
              <div className="text-3xl font-bold text-[var(--color-warning)]">
                {slots.filter((s) => s.status === 'available').length}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">Available Slots</div>
            </div>
            <div className="p-6 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
              <div className="text-3xl font-bold text-[var(--color-info)]">
                {totalTokens.toLocaleString()}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">Tokens Today</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Slots Overview
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {slots.map((slot) => (
                  <div
                    key={slot.slot_name}
                    className={`p-4 rounded-lg border ${
                      slot.status === 'available'
                        ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
                        : slot.status === 'occupied'
                          ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'
                          : 'bg-[var(--color-surface-2)] border-[var(--color-border)]'
                    }`}
                  >
                    <div className="font-medium">{slot.slot_name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {slot.status === 'available' ? 'Available' : slot.tenant_label || 'Occupied'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Recent Tenants
              </h2>
              <div className="space-y-2">
                {tenants.length === 0 ? (
                  <p className="text-[var(--color-text-muted)]">No tenants yet</p>
                ) : (
                  tenants.slice(0, 5).map((tenant) => (
                    <div
                      key={tenant.id}
                      className="p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{tenant.label}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {tenant.slug} • {tenant.supabase_url}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          tenant.status === 'active'
                            ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                            : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
                        }`}
                      >
                        {tenant.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">All Tenants</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    <th className="pb-3">Label</th>
                    <th className="pb-3">Slug</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Supabase</th>
                    <th className="pb-3">Created</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-3">{tenant.label}</td>
                      <td className="py-3 text-[var(--color-text-muted)]">{tenant.slug}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            tenant.status === 'active'
                              ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                              : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="py-3 text-[var(--color-text-muted)] truncate max-w-[200px]">
                        {tenant.supabase_url}
                      </td>
                      <td className="py-3 text-[var(--color-text-muted)]">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <TenantRepairActions tenantSlug={tenant.slug} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: server component error logging
    console.error('[admin] Error:', error);
    return (
      <div className="min-h-screen bg-[var(--color-surface-0)] p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-[var(--color-danger)]">Error</h1>
          <p className="text-[var(--color-text-muted)]">
            {error instanceof Error ? error.message : 'Failed to load admin data'}
          </p>
        </div>
      </div>
    );
  }
}
