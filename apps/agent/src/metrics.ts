/**
 * Prometheus-compatible metrics registry (lightweight, no external deps).
 * Exposes counters, histograms, and gauges in the Prometheus text exposition format.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type LabelSet = Record<string, string>;

interface CounterSeries {
  help: string;
  values: Map<string, number>; // serialized labels → value
}

interface HistogramSeries {
  help: string;
  buckets: number[]; // upper bounds
  observations: Map<string, number[]>; // serialized labels → raw observations
}

interface GaugeSeries {
  help: string;
  values: Map<string, number>; // serialized labels → value
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serializeLabels(labels?: LabelSet): string {
  if (!labels || Object.keys(labels).length === 0) return '__default__';
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
    .join(',');
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(q * (sorted.length - 1));
  return sorted[idx] ?? 0;
}

// ── Registry ──────────────────────────────────────────────────────────────────

class MetricsRegistry {
  private counters = new Map<string, CounterSeries>();
  private histograms = new Map<string, HistogramSeries>();
  private gauges = new Map<string, GaugeSeries>();

  // ── Counters ────────────────────────────────────────────────────────────────

  defineCounter(name: string, help: string): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { help, values: new Map() });
    }
  }

  incCounter(name: string, labels?: LabelSet, by = 1): void {
    let series = this.counters.get(name);
    if (!series) {
      series = { help: name, values: new Map() };
      this.counters.set(name, series);
    }
    const key = serializeLabels(labels);
    series.values.set(key, (series.values.get(key) ?? 0) + by);
  }

  getCounter(name: string, labels?: LabelSet): number {
    const series = this.counters.get(name);
    if (!series) return 0;
    return series.values.get(serializeLabels(labels)) ?? 0;
  }

  // ── Histograms ──────────────────────────────────────────────────────────────

  defineHistogram(
    name: string,
    help: string,
    buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  ): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, { help, buckets, observations: new Map() });
    }
  }

  observeHistogram(name: string, value: number, labels?: LabelSet): void {
    let series = this.histograms.get(name);
    if (!series) {
      series = {
        help: name,
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
        observations: new Map(),
      };
      this.histograms.set(name, series);
    }
    const key = serializeLabels(labels);
    const obs = series.observations.get(key) ?? [];
    obs.push(value);
    series.observations.set(key, obs);
  }

  getHistogramP50(name: string, labels?: LabelSet): number {
    return this._getHistogramPercentile(name, 0.5, labels);
  }

  getHistogramP95(name: string, labels?: LabelSet): number {
    return this._getHistogramPercentile(name, 0.95, labels);
  }

  private _getHistogramPercentile(name: string, q: number, labels?: LabelSet): number {
    const series = this.histograms.get(name);
    if (!series) return 0;
    const key = serializeLabels(labels);
    const obs = series.observations.get(key) ?? [];
    if (obs.length === 0) return 0;
    const sorted = [...obs].sort((a, b) => a - b);
    return quantile(sorted, q);
  }

  // ── Gauges ──────────────────────────────────────────────────────────────────

  defineGauge(name: string, help: string): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { help, values: new Map() });
    }
  }

  setGauge(name: string, value: number, labels?: LabelSet): void {
    let series = this.gauges.get(name);
    if (!series) {
      series = { help: name, values: new Map() };
      this.gauges.set(name, series);
    }
    series.values.set(serializeLabels(labels), value);
  }

  incGauge(name: string, by = 1, labels?: LabelSet): void {
    let series = this.gauges.get(name);
    if (!series) {
      series = { help: name, values: new Map() };
      this.gauges.set(name, series);
    }
    const key = serializeLabels(labels);
    series.values.set(key, (series.values.get(key) ?? 0) + by);
  }

  decGauge(name: string, by = 1, labels?: LabelSet): void {
    this.incGauge(name, -by, labels);
  }

  getGauge(name: string, labels?: LabelSet): number {
    const series = this.gauges.get(name);
    if (!series) return 0;
    return series.values.get(serializeLabels(labels)) ?? 0;
  }

  // ── Reset (for daily counters) ───────────────────────────────────────────────

  resetCounter(name: string): void {
    const series = this.counters.get(name);
    if (series) series.values.clear();
  }

  resetHistogram(name: string): void {
    const series = this.histograms.get(name);
    if (series) series.observations.clear();
  }

  // ── Prometheus text format ───────────────────────────────────────────────────

  serialize(): string {
    const lines: string[] = [];

    for (const [name, series] of this.counters) {
      lines.push(`# HELP ${name} ${series.help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const [labelKey, value] of series.values) {
        const lbl = labelKey === '__default__' ? '' : `{${labelKey}}`;
        lines.push(`${name}${lbl} ${value}`);
      }
    }

    for (const [name, series] of this.histograms) {
      lines.push(`# HELP ${name} ${series.help}`);
      lines.push(`# TYPE ${name} histogram`);

      for (const [labelKey, obs] of series.observations) {
        if (obs.length === 0) continue;

        const baseLbl = labelKey === '__default__' ? '' : `,${labelKey}`;
        const sorted = [...obs].sort((a, b) => a - b);

        for (const bucket of series.buckets) {
          const count = sorted.filter((v) => v <= bucket).length;
          const bucketLbl = `{le="${bucket}"${baseLbl}}`;
          lines.push(`${name}_bucket${bucketLbl} ${count}`);
        }
        // +Inf bucket
        lines.push(`${name}_bucket{{le="+Inf"${baseLbl}}} ${obs.length}`);

        const sum = obs.reduce((a, b) => a + b, 0);
        const countLbl = baseLbl ? `{${baseLbl.slice(1)}}` : '';
        lines.push(`${name}_sum${countLbl} ${sum}`);
        lines.push(`${name}_count${countLbl} ${obs.length}`);
      }
    }

    for (const [name, series] of this.gauges) {
      lines.push(`# HELP ${name} ${series.help}`);
      lines.push(`# TYPE ${name} gauge`);
      for (const [labelKey, value] of series.values) {
        const lbl = labelKey === '__default__' ? '' : `{${labelKey}}`;
        lines.push(`${name}${lbl} ${value}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const metrics = new MetricsRegistry();

// ── Pre-define all metrics ────────────────────────────────────────────────────

// Counters
metrics.defineCounter('hawk_llm_calls_total', 'Total LLM API calls');
metrics.defineCounter('hawk_tool_calls_total', 'Total tool executions');
metrics.defineCounter('hawk_messages_total', 'Total messages processed');
metrics.defineCounter('hawk_errors_total', 'Total errors by component and code');
metrics.defineCounter('hawk_fallbacks_total', 'Total model fallbacks');

// Histograms
metrics.defineHistogram(
  'hawk_llm_latency_seconds',
  'LLM call latency in seconds',
  [0.5, 1, 2, 5, 10, 20, 30, 60, 90],
);
metrics.defineHistogram(
  'hawk_tool_latency_seconds',
  'Tool execution latency in seconds',
  [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
);
metrics.defineHistogram(
  'hawk_pipeline_latency_seconds',
  'Middleware pipeline stage latency in seconds',
  [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
);
metrics.defineHistogram(
  'hawk_context_assembly_seconds',
  'Context assembly latency in seconds',
  [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
);

// Gauges
metrics.defineGauge('hawk_active_sessions', 'Currently active sessions');
metrics.defineGauge('hawk_daily_tokens_used', 'Daily tokens used per tenant');
metrics.defineGauge('hawk_daily_cost_usd', 'Daily cost in USD per tenant');
metrics.defineGauge('hawk_memory_count', 'Total memories per tenant');

export type { LabelSet };
