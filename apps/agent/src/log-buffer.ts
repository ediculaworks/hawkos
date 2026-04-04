/**
 * In-memory log buffer — captures console output and allows SSE streaming.
 *
 * Intercepts console.log/warn/error at startup and writes to a ring buffer
 * (last MAX_LINES lines). SSE subscribers receive new lines in real-time.
 *
 * Import this module early in the entry point (index.ts) so all output is captured.
 */

const MAX_LINES = 1_000;

export interface LogLine {
  ts: string; // ISO timestamp
  level: 'log' | 'warn' | 'error';
  text: string;
}

const _buffer: LogLine[] = [];
const _subscribers = new Set<(line: LogLine) => void>();

function pushLine(level: LogLine['level'], args: unknown[]) {
  const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const line: LogLine = { ts: new Date().toISOString(), level, text };

  _buffer.push(line);
  if (_buffer.length > MAX_LINES) _buffer.shift();

  for (const sub of _subscribers) {
    try {
      sub(line);
    } catch {
      // subscriber error — ignore
    }
  }
}

// Intercept console methods once (guard against double-import)
if (!(console as { __logBufferPatched?: boolean }).__logBufferPatched) {
  (console as { __logBufferPatched?: boolean }).__logBufferPatched = true;

  const _origLog = console.log.bind(console);
  const _origWarn = console.warn.bind(console);
  const _origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    _origLog(...args);
    pushLine('log', args);
  };
  console.warn = (...args: unknown[]) => {
    _origWarn(...args);
    pushLine('warn', args);
  };
  console.error = (...args: unknown[]) => {
    _origError(...args);
    pushLine('error', args);
  };
}

/**
 * Get the last `tail` lines from the buffer (most recent at end).
 */
export function getTailLines(tail = 200): LogLine[] {
  return _buffer.slice(-Math.min(tail, MAX_LINES));
}

/**
 * Subscribe to new log lines. Returns an unsubscribe function.
 */
export function subscribeToLogs(callback: (line: LogLine) => void): () => void {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}
