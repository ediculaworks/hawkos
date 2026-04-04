'use client';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EditSheet } from '@/components/ui/edit-sheet';
import { Input } from '@/components/ui/input';
import {
  deleteIntegration,
  fetchIntegrationConfig,
  saveIntegration,
  testIntegration,
} from '@/lib/actions/integrations';
import { CheckCircle, Eye, EyeOff, Loader2, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { IntegrationDefinition, IntegrationField } from './registry';

interface IntegrationFormProps {
  definition: IntegrationDefinition;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface TestResult {
  success: boolean;
  error?: string;
  details?: string;
}

function FieldInput({
  field,
  value,
  onChange,
  id,
}: {
  field: IntegrationField;
  value: string | number;
  onChange: (v: string | number) => void;
  id?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  if (field.type === 'select' && field.options) {
    return (
      <select
        id={id}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      >
        <option value="">Selecionar...</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'password') {
    return (
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <Input
      id={id}
      type={field.type}
      value={value}
      onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export function IntegrationForm({ definition, open, onClose, onSaved }: IntegrationFormProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load existing config when opening
  useEffect(() => {
    if (!open) {
      setConfig({});
      setTestResult(null);
      return;
    }

    setLoading(true);
    fetchIntegrationConfig(definition.provider)
      .then((result) => {
        if (result) setConfig(result.config);
      })
      .finally(() => setLoading(false));
  }, [open, definition.provider]);

  const handleFieldChange = useCallback((key: string, value: string | number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testIntegration(definition.provider, config);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }, [definition.provider, config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await saveIntegration(definition.provider, config, true);
      if (result.success) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [definition.provider, config, onSaved, onClose]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const result = await deleteIntegration(definition.provider);
      if (result.success) {
        onSaved();
        onClose();
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [definition.provider, onSaved, onClose]);

  const hasRequiredFields = definition.fields
    .filter((f) => f.required)
    .every((f) => {
      const val = config[f.key];
      return val !== undefined && val !== '' && val !== null;
    });

  return (
    <>
      <EditSheet open={open} onClose={onClose} title={`Configurar ${definition.name}`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : (
          <div className="space-y-[var(--space-5)]">
            {/* Fields */}
            <div className="space-y-[var(--space-4)]">
              {definition.fields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={field.key}
                    className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-1)]"
                  >
                    {field.label}
                    {field.required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
                  </label>
                  <FieldInput
                    id={field.key}
                    field={field}
                    value={(config[field.key] as string | number) ?? ''}
                    onChange={(v) => handleFieldChange(field.key, v)}
                  />
                  {field.helpText && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-1)]">
                      {field.helpText}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Test Connection */}
            {definition.testable && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing || !hasRequiredFields}
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Testar Conexão'}
                </Button>

                {testResult && (
                  <div
                    className={`flex items-center gap-[var(--space-2)] mt-[var(--space-2)] text-sm ${
                      testResult.success
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-danger)]'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{testResult.details || testResult.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-[var(--space-4)] border-t border-[var(--color-border)]">
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </Button>

              <div className="flex gap-[var(--space-2)]">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !hasRequiredFields}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </EditSheet>

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        title={`Remover ${definition.name}?`}
        description="As credenciais serão removidas permanentemente. O agente deixará de usar esta integração."
        confirmLabel={deleting ? 'Removendo...' : 'Remover'}
        variant="danger"
      />
    </>
  );
}
