'use client';

import { cn } from '@/lib/utils/cn';
import { MessageCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export function FloatingAgentCTA() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide on chat, mission control, and agents (pixel office has its own UI)
  if (
    pathname === '/dashboard/chat' ||
    pathname === '/dashboard/mission-control' ||
    pathname === '/dashboard/agents'
  )
    return null;

  return (
    <button
      type="button"
      onClick={() => router.push('/dashboard/chat')}
      className={cn(
        'fixed bottom-[var(--space-6)] right-[var(--space-6)] z-40',
        'flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-3)]',
        'rounded-full bg-[var(--color-accent)] text-white shadow-lg',
        'hover:bg-[var(--color-accent-hover)] hover:scale-105',
        'transition-all duration-200 ease-out cursor-pointer',
        'text-sm font-medium',
      )}
      title="Falar com Hawk"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Falar com Hawk</span>
    </button>
  );
}
