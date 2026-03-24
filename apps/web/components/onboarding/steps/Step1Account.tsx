'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPasswordStrength, step1Schema } from '@/lib/onboarding/validation';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface Step1AccountProps {
  onNext: (data: { email: string; password: string }) => void;
  onBack: () => void;
  initialValues?: { email?: string };
}

export function Step1Account({ onNext, onBack, initialValues }: Step1AccountProps) {
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordStrength = getPasswordStrength(password);
  const strengthPercent = (passwordStrength.score / 6) * 100;

  const requirements = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Uma letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Uma letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Um número', met: /[0-9]/.test(password) },
    { label: 'Um símbolo (!@#$%...)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = () => {
    const result = step1Schema.safeParse({ email, password, confirmPassword });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      for (const err of result.error.issues) {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      }
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onNext({ email, password });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Criar Conta</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Sua conta será usada para fazer login no sistema.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Email
          </label>
          <Input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Senha
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password strength bar */}
          {password.length > 0 && (
            <div className="mt-2">
              <div className="h-1 rounded-full bg-[var(--color-surface-2)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${strengthPercent}%`, backgroundColor: passwordStrength.color }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: passwordStrength.color }}>
                {passwordStrength.label}
              </p>
            </div>
          )}

          {/* Requirements checklist */}
          <div className="mt-3 space-y-1">
            {requirements.map((req) => (
              <div key={req.label} className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full flex items-center justify-center ${
                    req.met ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-2)]'
                  }`}
                >
                  {req.met && (
                    <svg
                      className="w-2 h-2 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      role="img"
                      aria-label="Requisito atendido"
                    >
                      <title>Requisito atendido</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-xs ${req.met ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}
                >
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Confirmar Senha
          </label>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="********"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {confirmPassword.length > 0 && (
            <p
              className={`text-xs mt-1 ${passwordsMatch ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
            >
              {passwordsMatch ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
            </p>
          )}
          {errors.confirmPassword && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.confirmPassword}</p>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          ← Voltar
        </Button>
        <Button onClick={handleSubmit} disabled={!allRequirementsMet || !passwordsMatch || !email}>
          Próximo →
        </Button>
      </div>
    </div>
  );
}
