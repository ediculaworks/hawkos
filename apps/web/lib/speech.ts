// Speech Service - TTS/STT wrapper
// STT: usa Web Speech API do browser (nativa)
// TTS: API para Piper local ou ElevenLabs

export interface SpeechConfig {
  ttsProvider: 'piper' | 'elevenlabs' | 'browser';
  sttProvider: 'browser' | 'whisper';
  voiceId?: string;
  pitch?: number;
  rate?: number;
}

const DEFAULT_CONFIG: SpeechConfig = {
  ttsProvider: 'browser',
  sttProvider: 'browser',
  pitch: 1,
  rate: 1,
};

class SpeechService {
  private config: SpeechConfig = DEFAULT_CONFIG;
  private recognition: unknown = null;
  private synthesis: unknown = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = (window as unknown as { speechSynthesis?: unknown }).speechSynthesis ?? null;
    }
  }

  configure(config: Partial<SpeechConfig>) {
    this.config = { ...this.config, ...config };
  }

  // STT - Speech to Text using Web Speech API
  startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
  ): void {
    if (typeof window === 'undefined') {
      onError?.('Speech recognition not available on server');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
      speechSynthesis?: unknown;
    };

    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onError?.('Speech recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    const rec = this.recognition as unknown as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (event: unknown) => void;
      onerror: (event: { error: string }) => void;
      start: () => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'pt-BR';

    rec.onresult = (event: unknown) => {
      const evt = event as {
        results: { length: number; [i: number]: { 0: { transcript: string; isFinal: boolean } } };
      };
      const results = evt.results;
      const lastResult = results[results.length - 1];
      if (lastResult) {
        onResult(lastResult[0].transcript, lastResult[0].isFinal);
      }
    };

    rec.onerror = (event: { error: string }) => {
      onError?.(event.error);
    };

    rec.start();
  }

  stopListening(): void {
    if (this.recognition) {
      const rec = this.recognition as { stop: () => void };
      rec.stop();
      this.recognition = null;
    }
  }

  // TTS - Text to Speech
  speak(text: string, onStart?: () => void, onEnd?: () => void): void {
    if (!this.synthesis) return;

    const synth = this.synthesis as {
      speak: (utterance: unknown) => void;
      cancel: () => void;
      getVoices: () => { lang: string }[];
    };
    const win = window as unknown as { SpeechSynthesisUtterance?: new (text: string) => unknown };
    const Utterance = win.SpeechSynthesisUtterance;

    if (!Utterance) return;

    const utterance = new Utterance(text) as {
      voice: { lang: string } | null;
      pitch: number;
      rate: number;
      onstart: (() => void) | null;
      onend: (() => void) | null;
    };

    const voices = synth.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.pitch = this.config.pitch ?? 1;
    utterance.rate = this.config.rate ?? 1;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();

    synth.speak(utterance);
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      const synth = this.synthesis as { cancel: () => void };
      synth.cancel();
    }
  }

  getVoices(): { lang: string }[] {
    const synth = this.synthesis as { getVoices?: () => { lang: string }[] };
    return synth?.getVoices?.() ?? [];
  }

  isListening(): boolean {
    return this.recognition !== null;
  }
}

export const speechService = new SpeechService();
