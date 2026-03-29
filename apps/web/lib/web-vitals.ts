/**
 * Web Vitals reporting — tracks CLS, FID/INP, LCP, FCP, TTFB.
 * Reports to console in dev, to activity_log via API in production.
 */

import type { Metric } from 'web-vitals';

const REPORT_ENDPOINT = '/api/agent/errors';

function reportMetric(metric: Metric) {
  const body = {
    message: `[WebVital] ${metric.name}: ${metric.value.toFixed(2)}`,
    component: 'web-vitals',
    stack: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      delta: metric.delta,
      id: metric.id,
    }),
  };

  if (process.env.NODE_ENV === 'development') {
    const color = metric.rating === 'good' ? '🟢' : metric.rating === 'needs-improvement' ? '🟡' : '🔴';
    console.log(`${color} ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
    return;
  }

  // Production: report to backend
  if (navigator.sendBeacon) {
    navigator.sendBeacon(REPORT_ENDPOINT, JSON.stringify(body));
  } else {
    fetch(REPORT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }
}

export function initWebVitals() {
  import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
    onCLS(reportMetric);
    onINP(reportMetric);
    onLCP(reportMetric);
    onFCP(reportMetric);
    onTTFB(reportMetric);
  });
}
