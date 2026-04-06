/* eslint-disable */

// Augment ImportMeta with Bun-specific properties
interface ImportMeta {
  /** Absolute path to the directory containing this file (Bun-specific) */
  dir: string;
  /** Absolute path to this file (Bun-specific) */
  path: string;
}

declare const Bun: {
  serve(options: Record<string, unknown>): { port: number; stop(): void };
  spawn(
    cmd: string[],
    opts?: Record<string, unknown>,
  ): {
    stdout: ReadableStream;
    stderr: ReadableStream;
    exited: Promise<number>;
    kill(signal?: number): void;
  };
  env: Record<string, string | undefined>;
  sleep(ms: number): Promise<void>;
};
