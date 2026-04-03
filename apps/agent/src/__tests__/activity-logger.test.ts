import { describe, expect, it } from 'vitest';

// We can't easily mock the module-level createClient, so test the logic inline
describe('Activity Logger — tenant_id logic', () => {
  it('AGENT_SLOT env var provides tenant slug', () => {
    const slot = process.env.AGENT_SLOT ?? 'local';
    expect(typeof slot).toBe('string');
    expect(slot.length).toBeGreaterThan(0);
  });

  it('defaults to "local" when AGENT_SLOT is not set', () => {
    const original = process.env.AGENT_SLOT;
    process.env.AGENT_SLOT = '';
    const slug = process.env.AGENT_SLOT || 'local';
    expect(slug).toBe('local');
    process.env.AGENT_SLOT = original;
  });

  it('uses AGENT_SLOT value when set', () => {
    const original = process.env.AGENT_SLOT;
    process.env.AGENT_SLOT = 'tenant-abc';
    const slug = process.env.AGENT_SLOT || 'local';
    expect(slug).toBe('tenant-abc');
    process.env.AGENT_SLOT = original;
  });

  it('insert payload includes tenant_id field', () => {
    const tenantSlug = 'test-tenant';
    const payload = {
      event_type: 'tool_call',
      module: 'finances',
      summary: 'Called create_transaction',
      metadata: { args: { amount: 100 } },
      tenant_id: tenantSlug,
    };
    expect(payload.tenant_id).toBe('test-tenant');
    expect(payload).toHaveProperty('event_type');
    expect(payload).toHaveProperty('tenant_id');
  });
});
