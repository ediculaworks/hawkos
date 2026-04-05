'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MeData {
  email: string;
  role: string;
  tenant: string;
  onboardingComplete: boolean;
  name: string | null;
}

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: MeData | null) => {
        if (cancelled || !data) return;

        const isSetupPage = pathname === '/setup';

        if (data.onboardingComplete && isSetupPage) {
          router.replace('/dashboard');
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">Carregando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
