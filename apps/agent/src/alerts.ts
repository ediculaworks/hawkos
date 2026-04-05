/**
 * Alert system — checks metrics thresholds every 60s and emits system:alert events.
 * Lightweight alternative to full alertmanager for a VPS deployment.
 */

import { eventBus } from '@hawk/shared';
import { getConfig } from '@hawk/shared';
import { logActivity } from './activity-logger.js';
import { metrics } from './metrics.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlertRule {
  name: string;
  condition: () => boolean;
  message: () => string;
  cooldownMs: number;
  severity: 'warning' | 'critical';
}

// ── Cooldown tracking ─────────────────────────────────────────────────────────

const _lastFired = new Map<string, number>();

function isInCooldown(ruleName: string, cooldownMs: number): boolean {
  const last = _lastFired.get(ruleName);
  if (!last) return false;
  return Date.now() - last < cooldownMs;
}

function markFired(ruleName: string): void {
  _lastFired.set(ruleName, Date.now());
}

// ── Alert Rules ───────────────────────────────────────────────────────────────

const alertRules: AlertRule[] = [
  {
    name: 'high_error_rate',
    condition: () => {
      const total = metrics.getCounter('hawk_messages_total');
      const errors = metrics.getCounter('hawk_errors_total');
      return total > 10 && errors / total > 0.05;
    },
    message: () => {
      const total = metrics.getCounter('hawk_messages_total');
      const errors = metrics.getCounter('hawk_errors_total');
      const pct = total > 0 ? ((errors / total) * 100).toFixed(1) : '0';
      return `Error rate ${pct}% (${errors}/${total} requests)`;
    },
    cooldownMs: 15 * 60 * 1000, // 15 min
    severity: 'critical',
  },

  {
    name: 'budget_warning',
    condition: () => {
      const cost = metrics.getGauge('hawk_daily_cost_usd');
      try {
        const budget = getConfig().MODEL_DAILY_BUDGET_USD;
        return cost > budget * 0.8;
      } catch {
        return false; // config not loaded yet
      }
    },
    message: () => {
      const cost = metrics.getGauge('hawk_daily_cost_usd');
      return `Daily cost $${cost.toFixed(4)} exceeds 80% of budget`;
    },
    cooldownMs: 60 * 60 * 1000, // 1h
    severity: 'warning',
  },

  {
    name: 'high_latency',
    condition: () => {
      const p95 = metrics.getHistogramP95('hawk_pipeline_latency_seconds');
      return p95 > 15;
    },
    message: () => {
      const p95 = metrics.getHistogramP95('hawk_pipeline_latency_seconds');
      return `Pipeline p95 latency ${p95.toFixed(1)}s exceeds 15s threshold`;
    },
    cooldownMs: 30 * 60 * 1000, // 30 min
    severity: 'warning',
  },

  {
    name: 'high_fallback_rate',
    condition: () => {
      const total = metrics.getCounter('hawk_llm_calls_total');
      const fallbacks = metrics.getCounter('hawk_fallbacks_total');
      return total > 5 && fallbacks / total > 0.3;
    },
    message: () => {
      const fallbacks = metrics.getCounter('hawk_fallbacks_total');
      return `High model fallback rate: ${fallbacks} fallbacks`;
    },
    cooldownMs: 30 * 60 * 1000,
    severity: 'warning',
  },
];

// ── Alert checker ─────────────────────────────────────────────────────────────

let _intervalHandle: ReturnType<typeof setInterval> | null = null;

function runAlertCheck(): void {
  for (const rule of alertRules) {
    try {
      if (!rule.condition()) continue;
      if (isInCooldown(rule.name, rule.cooldownMs)) continue;

      const message = rule.message();
      markFired(rule.name);

      // Emit event for SSE/Discord notification
      eventBus.emit('system:alert', {
        name: rule.name,
        severity: rule.severity,
        message,
      });

      // Log to activity_log
      logActivity(
        'security',
        `[ALERT/${rule.severity.toUpperCase()}] ${rule.name}: ${message}`,
        undefined,
        { alert_name: rule.name, severity: rule.severity, message },
      ).catch(() => {});
    } catch {
      // Never let alert checks crash the process
    }
  }
}

export function startAlertChecker(): void {
  if (_intervalHandle) return; // already running
  _intervalHandle = setInterval(runAlertCheck, 60_000);
}

export function stopAlertChecker(): void {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}

/** Exposed for testing */
export { runAlertCheck };
