'use client';

import { ONBOARDING_STEPS, type TenantSlot } from '@/lib/onboarding/types';
import { loadOnboardingDraft } from '@/lib/onboarding/utils';
import { useEffect, useState } from 'react';

import { Step0Slot } from './steps/Step0Slot';
import { Step1Account } from './steps/Step1Account';
import { Step2Profile } from './steps/Step2Profile';
import { Step3Integrations } from './steps/Step3Integrations';
import { Step4Modules } from './steps/Step4Modules';
import { Step5Configure } from './steps/Step5Configure';
import { Step6Complete } from './steps/Step6Complete';

interface OnboardingData {
  workspaceLabel?: string;
  slot?: string;
  supabaseUrl?: string;
  anonKey?: string;
  serviceRoleKey?: string;
  email?: string;
  password?: string;
  name?: string;
  cpf?: string;
  birthDate?: string;
  timezone?: string;
  openrouter?: { apiKey: string; model?: string };
  discord?: {
    botToken: string;
    clientId: string;
    guildId: string;
    channelId: string;
    userId: string;
  };
  modules?: string[];
  agents?: string[];
}

interface Props {
  slots: TenantSlot[];
}

type StepId =
  | 'slot'
  | 'account'
  | 'profile'
  | 'integrations'
  | 'modules'
  | 'configure'
  | 'complete';

const STEP_ORDER: StepId[] = [
  'slot',
  'account',
  'profile',
  'integrations',
  'modules',
  'configure',
  'complete',
];

export function OnboardingWizard({ slots: _slots }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<OnboardingData>({});
  const [envContent, setEnvContent] = useState('');
  const [mounted, setMounted] = useState(false);

  // Load draft after mount to avoid SSR hydration mismatch
  useEffect(() => {
    const draft = loadOnboardingDraft();
    setFormData(draft.data);
    setCurrentStepIndex(draft.step);
    setMounted(true);
  }, []);

  const currentStep = STEP_ORDER[currentStepIndex];
  const currentStepInfo =
    ONBOARDING_STEPS.find((s) => s.id === currentStep) ?? ONBOARDING_STEPS[0]!;

  // Persist draft on every change (never save password)
  useEffect(() => {
    if (!mounted) return;
    try {
      const { password: _pw, ...safeData } = formData;
      localStorage.setItem(
        'hawk-onboarding-draft',
        JSON.stringify({ ...safeData, _step: currentStepIndex }),
      );
    } catch {}
  }, [formData, currentStepIndex, mounted]);

  const updateData = (data: Partial<OnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const goNext = () => {
    if (currentStepIndex < STEP_ORDER.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleConfigureComplete = (env: string, assignedSlot: string) => {
    setFormData((prev) => ({ ...prev, slot: assignedSlot }));
    setEnvContent(env);
    goNext();
  };

  const handleComplete = () => {
    try {
      localStorage.removeItem('hawk-onboarding-draft');
    } catch {}
    window.location.href = '/dashboard';
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {ONBOARDING_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    isCompleted
                      ? 'bg-[var(--color-success)] text-white'
                      : isCurrent
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      index < currentStepIndex
                        ? 'bg-[var(--color-success)]'
                        : 'bg-[var(--color-surface-2)]'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {currentStepInfo.title}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">{currentStepInfo.description}</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 'slot' && (
          <Step0Slot
            onNext={(data) => {
              updateData(data);
              goNext();
            }}
          />
        )}

        {currentStep === 'account' && (
          <Step1Account
            onNext={(data) => {
              updateData(data);
              goNext();
            }}
            onBack={goBack}
            initialValues={{ email: formData.email }}
          />
        )}

        {currentStep === 'profile' && (
          <Step2Profile
            onNext={(data) => {
              updateData(data);
              goNext();
            }}
            onBack={goBack}
            initialValues={{
              name: formData.name,
              cpf: formData.cpf,
              birthDate: formData.birthDate,
              timezone: formData.timezone,
            }}
          />
        )}

        {currentStep === 'integrations' && (
          <Step3Integrations
            onNext={(data) => {
              updateData(data);
              goNext();
            }}
            onBack={goBack}
            initialValues={{
              supabaseUrl: formData.supabaseUrl,
              anonKey: formData.anonKey,
              serviceRoleKey: formData.serviceRoleKey,
              openrouter: formData.openrouter,
              discord: formData.discord,
            }}
          />
        )}

        {currentStep === 'modules' && (
          <Step4Modules
            onNext={(data) => {
              updateData(data);
              goNext();
            }}
            onBack={goBack}
            initialValues={{ modules: formData.modules, agents: formData.agents }}
          />
        )}

        {currentStep === 'configure' && formData.supabaseUrl && formData.name && (
          <Step5Configure
            formData={{
              workspaceLabel: formData.workspaceLabel,
              supabaseUrl: formData.supabaseUrl || '',
              anonKey: formData.anonKey || '',
              serviceRoleKey: formData.serviceRoleKey || '',
              name: formData.name,
              email: formData.email,
              password: formData.password,
              cpf: formData.cpf,
              birthDate: formData.birthDate,
              timezone: formData.timezone,
              openrouter: formData.openrouter,
              discord: formData.discord,
              modules: formData.modules || [],
              agents: formData.agents || [],
            }}
            onComplete={handleConfigureComplete}
            onError={goBack}
          />
        )}

        {currentStep === 'complete' && formData.slot && (
          <Step6Complete slot={formData.slot} envContent={envContent} onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
