'use client';

import { OfficeCanvas } from '@/components/agents/office/office-canvas';
import { OfficeHUD } from '@/components/agents/office/overlays/office-hud';

export default function AgentsPage() {
  return (
    <div className="relative w-full h-[calc(100vh-var(--topbar-height,56px))] overflow-hidden bg-[#111122]">
      <OfficeCanvas />
      <OfficeHUD />
    </div>
  );
}
