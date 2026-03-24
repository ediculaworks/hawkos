const TZ = 'America/Sao_Paulo';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TZ,
});

const dateShortFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: TZ,
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});

const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', {
  numeric: 'auto',
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatCurrencyCompact(value: number): string {
  return compactCurrencyFormatter.format(value);
}

export function formatDate(date: string | Date): string {
  return dateFormatter.format(typeof date === 'string' ? new Date(date) : date);
}

export function formatDateShort(date: string | Date): string {
  return dateShortFormatter.format(typeof date === 'string' ? new Date(date) : date);
}

export function formatDateTime(date: string | Date): string {
  return dateTimeFormatter.format(typeof date === 'string' ? new Date(date) : date);
}

export function formatRelativeDay(date: string | Date): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'hoje';
  if (Math.abs(diffDays) < 7) return relativeFormatter.format(diffDays, 'day');
  if (Math.abs(diffDays) < 30) return relativeFormatter.format(Math.round(diffDays / 7), 'week');
  return relativeFormatter.format(Math.round(diffDays / 30), 'month');
}

export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Returns today's date as YYYY-MM-DD in São Paulo timezone.
 * Use this instead of `new Date().toISOString().slice(0, 10)` which returns UTC date.
 */
export function todayDateStr(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

/**
 * Format a time string in São Paulo timezone.
 */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(typeof date === 'string' ? new Date(date) : date);
}
