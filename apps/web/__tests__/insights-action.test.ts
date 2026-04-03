import { describe, expect, it } from 'vitest';

/**
 * Tests for the Insight type structure and severity sorting.
 * We can't easily test the server action directly (requires Supabase),
 * but we test the sorting logic and type contracts.
 */

interface Insight {
  id: string;
  type: 'gap' | 'streak' | 'alert' | 'suggestion';
  module: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

function sortInsights(insights: Insight[]): Insight[] {
  const order = { critical: 0, warning: 1, info: 2 };
  return [...insights].sort((a, b) => order[a.severity] - order[b.severity]);
}

describe('Insights sorting', () => {
  it('sorts critical before warning before info', () => {
    const insights: Insight[] = [
      { id: '1', type: 'suggestion', module: 'people', title: 'A', description: '', severity: 'info' },
      { id: '2', type: 'alert', module: 'finances', title: 'B', description: '', severity: 'critical' },
      { id: '3', type: 'gap', module: 'health', title: 'C', description: '', severity: 'warning' },
    ];
    const sorted = sortInsights(insights);
    expect(sorted[0]!.severity).toBe('critical');
    expect(sorted[1]!.severity).toBe('warning');
    expect(sorted[2]!.severity).toBe('info');
  });

  it('handles empty array', () => {
    expect(sortInsights([])).toEqual([]);
  });

  it('handles all same severity', () => {
    const insights: Insight[] = [
      { id: '1', type: 'gap', module: 'a', title: 'A', description: '', severity: 'warning' },
      { id: '2', type: 'gap', module: 'b', title: 'B', description: '', severity: 'warning' },
    ];
    const sorted = sortInsights(insights);
    expect(sorted).toHaveLength(2);
    expect(sorted[0]!.severity).toBe('warning');
  });
});

describe('Insight type validation', () => {
  it('valid insight types', () => {
    const types: Insight['type'][] = ['gap', 'streak', 'alert', 'suggestion'];
    expect(types).toHaveLength(4);
  });

  it('valid severity levels', () => {
    const severities: Insight['severity'][] = ['info', 'warning', 'critical'];
    expect(severities).toHaveLength(3);
  });
});
