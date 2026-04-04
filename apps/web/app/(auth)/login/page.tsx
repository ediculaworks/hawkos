'use client';

import { ReactBitsGuard } from '@/components/react-bits/_adapter';
import ShinyText from '@/components/react-bits/text/shiny-text';
import TypingAnimation from '@/components/react-bits/text/typing-animation';
import { EASE } from '@/lib/animations/constants';
import { ChevronDown, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { SplashScreen } from './splash-screen';

const Aurora = dynamic(() => import('@/components/react-bits/backgrounds/aurora'), {
  ssr: false,
});

interface TenantPublic {
  slug: string;
  label: string;
}

type Stage = 'form' | 'authenticating' | 'splash';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('form');

  // Multi-tenant state
  const [tenants, setTenants] = useState<TenantPublic[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantPublic | null>(null);
  const multiTenant = tenants.length > 0;

  const loading = stage === 'authenticating';

  // Fetch available tenants on mount
  useEffect(() => {
    fetch('/api/tenants')
      .then((res) => res.json())
      .then((data) => {
        if (data.tenants?.length > 0) {
          setTenants(data.tenants);
          if (data.tenants.length === 1) {
            setSelectedTenant(data.tenants[0]);
          }
        }
      })
      .catch(() => {
        // No tenants API — single-tenant mode
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStage('authenticating');

    try {
      // Authenticate via our custom API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          tenantSlug: selectedTenant?.slug,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(
          result.error === 'Invalid email or password'
            ? 'Email ou senha incorretos.'
            : result.error || 'Erro ao conectar.',
        );
        setStage('form');
        return;
      }

      setStage('splash');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar. Tente novamente.');
      setStage('form');
    }
  };

  const handleSplashComplete = useCallback(() => {
    // Full page reload ensures auth cookies are sent with the request
    window.location.href = '/dashboard';
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-surface-0)]">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0 opacity-15">
        <ReactBitsGuard
          fallback={
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent" />
          }
        >
          <Aurora
            colorStops={['#4060ff', '#40c060', '#e040a0']}
            amplitude={1.2}
            blend={0.6}
            speed={0.8}
          />
        </ReactBitsGuard>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {stage !== 'splash' ? (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.35, ease: EASE.outQuart }}
            className="relative z-10 w-full max-w-sm"
          >
            {/* Glass card */}
            <div className="rounded-[var(--radius-xl)] border border-white/[0.06] bg-[var(--color-surface-1)]/60 p-8 shadow-lg backdrop-blur-xl">
              <div className="space-y-6">
                {/* Logo */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: EASE.outQuart }}
                  className="text-center space-y-2"
                >
                  <h1 className="text-3xl font-bold tracking-tight">
                    <ShinyText
                      text="Hawk OS"
                      speed={3}
                      color="var(--color-text-primary)"
                      shineColor="var(--color-accent)"
                    />
                  </h1>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    <TypingAnimation
                      text="Personal Life Operating System"
                      typingSpeed={40}
                      initialDelay={600}
                      showCursor={true}
                      cursorCharacter="▋"
                      cursorClassName="text-[var(--color-accent)] opacity-70"
                      loop={false}
                    />
                  </div>
                </motion.div>

                {/* Form */}
                <motion.form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  {/* Workspace selector (multi-tenant only) */}
                  {multiTenant && (
                    <div>
                      <label
                        htmlFor="workspace"
                        className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 transition-colors"
                      >
                        Workspace
                      </label>
                      <div className="relative">
                        <select
                          id="workspace"
                          value={selectedTenant?.slug ?? ''}
                          onChange={(e) => {
                            const t = tenants.find((t) => t.slug === e.target.value);
                            setSelectedTenant(t ?? null);
                          }}
                          className="w-full appearance-none rounded-[var(--radius-md)] border border-white/[0.08] bg-[var(--color-surface-0)]/80 px-3 py-2.5 pr-8 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]/30 transition-all duration-200 cursor-pointer"
                        >
                          <option value="" disabled>
                            Selecione um workspace...
                          </option>
                          {tenants.map((t) => (
                            <option key={t.slug} value={t.slug}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 transition-colors"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full rounded-[var(--radius-md)] border border-white/[0.08] bg-[var(--color-surface-0)]/80 px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]/30 transition-all duration-200"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 transition-colors"
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="w-full rounded-[var(--radius-md)] border border-white/[0.08] bg-[var(--color-surface-0)]/80 px-3 py-2.5 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]/30 transition-all duration-200"
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-3 py-2">
                          <p className="text-xs text-[var(--color-danger)]">{error}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading || !email || !password || (multiTenant && !selectedTenant)}
                    className="w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </button>
                </motion.form>
              </div>
            </div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="mt-4 space-y-1 text-center"
            >
              {multiTenant ? (
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {tenants.length} workspaces available
                </p>
              ) : (
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Single-tenant system. Contact admin for access.
                </p>
              )}
              <p className="text-[10px] text-[var(--color-text-muted)] opacity-60">
                Acesso restrito. Contate o administrador.
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <SplashScreen onComplete={handleSplashComplete} />
        )}
      </AnimatePresence>
    </div>
  );
}
