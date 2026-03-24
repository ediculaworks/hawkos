import { getAudioBuffer } from '../engine/asset-loader';
import { MASTER_VOLUME } from '../engine/types';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let unlocked = false;

export function getAudioContext(): AudioContext | undefined {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = MASTER_VOLUME;
      masterGain.connect(audioCtx.destination);
    } catch {
      return undefined;
    }
  }
  return audioCtx;
}

/** Must be called from a user interaction to unlock audio on mobile/some browsers */
export function unlockAudio(): void {
  if (unlocked) return;
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    ctx.resume();
  }
  unlocked = true;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (masterGain) {
    masterGain.gain.value = m ? 0 : MASTER_VOLUME;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function playSound(key: string, options?: { volume?: number; loop?: boolean }): void {
  if (muted || !audioCtx || !masterGain) return;

  const buffer = getAudioBuffer(key);
  if (!buffer) return;

  try {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = options?.loop ?? false;

    if (options?.volume !== undefined) {
      const gain = audioCtx.createGain();
      gain.gain.value = options.volume;
      source.connect(gain);
      gain.connect(masterGain);
    } else {
      source.connect(masterGain);
    }

    source.start();
  } catch {
    // Graceful failure
  }
}
