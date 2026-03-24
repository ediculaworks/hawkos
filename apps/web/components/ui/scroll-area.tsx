'use client';

import { cn } from '@/lib/utils/cn';
import type { HTMLAttributes } from 'react';

export function ScrollArea({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-auto', className)} {...props}>
      {children}
    </div>
  );
}
