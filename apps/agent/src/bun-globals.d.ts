/* eslint-disable */
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
