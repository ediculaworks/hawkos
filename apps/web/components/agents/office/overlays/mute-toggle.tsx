'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { setMuted } from '../sound/sound-manager';
import { useOfficeStore } from '../store/office-store';

export function MuteToggle() {
  const soundMuted = useOfficeStore((s) => s.soundMuted);
  const toggleMute = useOfficeStore((s) => s.toggleMute);

  const handleToggle = () => {
    toggleMute();
    setMuted(!soundMuted);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="absolute top-3 right-3 z-30 w-8 h-8 flex items-center justify-center bg-[#1e1e2e] border-2 border-[#4a4a6a] text-[#aaaaaa] hover:text-white hover:border-[#6a6a8a] transition-colors shadow-[2px_2px_0px_#0a0a14]"
      title={soundMuted ? 'Ativar som' : 'Desativar som'}
    >
      {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
