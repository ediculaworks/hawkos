/**
 * Tenant isolation tests — verifies that schema-per-tenant model
 * correctly isolates data between tenants.
 */
import { describe, expect, it } from 'vitest';
import { getCurrentSchema, schemaStore, validateSchemaName } from '../sql.ts';

describe('tenant isolation', () => {
  describe('schema context', () => {
    it('defaults to TENANT_SCHEMA env or public', () => {
      const original = process.env.TENANT_SCHEMA;
      delete process.env.TENANT_SCHEMA;

      // Outside of any schema context, should default to 'public'
      expect(getCurrentSchema()).toBe('public');

      process.env.TENANT_SCHEMA = original;
    });

    it('respects TENANT_SCHEMA env var', () => {
      const original = process.env.TENANT_SCHEMA;
      process.env.TENANT_SCHEMA = 'tenant_ten1';

      expect(getCurrentSchema()).toBe('tenant_ten1');

      process.env.TENANT_SCHEMA = original;
    });

    it('AsyncLocalStorage isolates schemas between async contexts', async () => {
      const results: string[] = [];

      await Promise.all([
        schemaStore.run('tenant_ten1', async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(`a:${getCurrentSchema()}`);
        }),
        schemaStore.run('tenant_ten2', async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(`b:${getCurrentSchema()}`);
        }),
      ]);

      expect(results).toContain('a:tenant_ten1');
      expect(results).toContain('b:tenant_ten2');
    });

    it('schema context does not leak between runs', async () => {
      await schemaStore.run('tenant_ten1', async () => {
        expect(getCurrentSchema()).toBe('tenant_ten1');
      });

      // After the run, should be back to default
      const original = process.env.TENANT_SCHEMA;
      delete process.env.TENANT_SCHEMA;
      expect(getCurrentSchema()).toBe('public');
      process.env.TENANT_SCHEMA = original;
    });

    it('nested schema contexts use innermost value', async () => {
      await schemaStore.run('tenant_ten1', async () => {
        expect(getCurrentSchema()).toBe('tenant_ten1');

        await schemaStore.run('tenant_ten2', async () => {
          expect(getCurrentSchema()).toBe('tenant_ten2');
        });

        // Back to outer context
        expect(getCurrentSchema()).toBe('tenant_ten1');
      });
    });
  });

  describe('schema name validation', () => {
    it('rejects schema names with SQL injection patterns', () => {
      const malicious = [
        'ten1"; DROP TABLE users--',
        "ten1'; DELETE FROM tenants--",
        'ten1; SELECT * FROM admin.tenants',
        '../../../etc/passwd',
        'ten1\x00malicious',
      ];

      for (const name of malicious) {
        expect(() => validateSchemaName(name)).toThrow('Invalid schema name');
      }
    });

    it('accepts valid schema names', () => {
      const valid = [
        'public',
        'tenant_ten1',
        'tenant_ten2',
        'tenant_ten6',
      ];

      for (const name of valid) {
        expect(() => validateSchemaName(name)).not.toThrow();
      }
    });
  });
});
