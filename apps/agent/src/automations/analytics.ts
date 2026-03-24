import {
  detectSpendingAnomalies,
  forecastMonthlySpending,
  formatAnomalyAlert,
  formatForecastSummary,
} from '@hawk/module-finances/analytics';
import {
  discoverHealthCorrelations,
  formatCorrelationsSummary,
} from '@hawk/module-health/analytics';
import { formatPrediction, predictMoodEnergy } from '@hawk/module-health/predictor';
import { assessHabitRisks, formatRiskSummary } from '@hawk/module-routine/analytics';
import cron, { type ScheduledTask } from 'node-cron';

/**
 * Analytics Automation — ML/Statistical Models
 *
 * Runs statistical models on user data and sends insights via Discord.
 * These models run WITHOUT any LLM calls — pure math on structured data.
 *
 * Schedule:
 * - Daily 08:30: Habit risk assessment + spending anomalies
 * - Weekly Sunday 19:00: Health correlations + spending forecast
 */

type NotifySender = ((message: string) => Promise<void>) | null;
let notify: NotifySender = null;

export function setAnalyticsNotifier(sender: NotifySender): void {
  notify = sender;
}

/**
 * Daily analytics: habit risks + spending anomalies.
 * Runs at 08:30, before the daily checkin (09:00).
 */
async function runDailyAnalytics(): Promise<void> {
  const parts: string[] = [];

  // B4: Habit failure prediction
  try {
    const risks = await assessHabitRisks();
    const riskSummary = formatRiskSummary(risks);
    if (riskSummary) parts.push(riskSummary);
  } catch (err) {
    console.error('[analytics] Habit risk assessment failed:', err);
  }

  // C3: Mood/energy prediction
  try {
    const prediction = await predictMoodEnergy();
    if (prediction) parts.push(formatPrediction(prediction));
  } catch (err) {
    console.error('[analytics] Mood prediction failed:', err);
  }

  // B1: Spending anomaly detection
  try {
    const anomalies = await detectSpendingAnomalies(90, 1); // Last 1 day, 90-day baseline
    const anomalyAlert = formatAnomalyAlert(anomalies);
    if (anomalyAlert) parts.push(anomalyAlert);
  } catch (err) {
    console.error('[analytics] Spending anomaly detection failed:', err);
  }

  if (parts.length > 0 && notify) {
    await notify(`**Analytics Diário**\n\n${parts.join('\n\n')}`).catch(() => {});
  }
}

/**
 * Weekly analytics: health correlations + spending forecast.
 * Runs Sunday evening, before the weekly review.
 */
async function runWeeklyAnalytics(): Promise<void> {
  const parts: string[] = [];

  // B2: Health correlation discovery
  try {
    const correlations = await discoverHealthCorrelations(30, 0.3);
    const corrSummary = formatCorrelationsSummary(correlations);
    if (corrSummary) parts.push(corrSummary);
  } catch (err) {
    console.error('[analytics] Health correlation discovery failed:', err);
  }

  // B3: Monthly spending forecast
  try {
    const forecast = await forecastMonthlySpending(0.4);
    const forecastSummary = formatForecastSummary(forecast);
    if (forecastSummary) parts.push(forecastSummary);
  } catch (err) {
    console.error('[analytics] Spending forecast failed:', err);
  }

  if (parts.length > 0 && notify) {
    await notify(`**Analytics Semanal**\n\n${parts.join('\n\n')}`).catch(() => {});
  }
}

/**
 * Start analytics cron jobs.
 */
export function startAnalyticsCrons(): ScheduledTask[] {
  const tasks: ScheduledTask[] = [];

  // Daily: 08:30 — habit risks + spending anomalies
  tasks.push(
    cron.schedule('30 8 * * *', () => {
      runDailyAnalytics().catch((err) => console.error('[analytics] Daily analytics failed:', err));
    }),
  );

  // Weekly: Sunday 19:00 — correlations + forecast
  tasks.push(
    cron.schedule('0 19 * * 0', () => {
      runWeeklyAnalytics().catch((err) =>
        console.error('[analytics] Weekly analytics failed:', err),
      );
    }),
  );

  return tasks;
}

// Export for manual testing
export { runDailyAnalytics, runWeeklyAnalytics };
