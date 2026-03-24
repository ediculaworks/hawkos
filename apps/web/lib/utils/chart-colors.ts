/**
 * Chart colors derived from the OKLCH design system.
 * All colors share L=0.72, C=0.14 for perceptual uniformity.
 * Hues are spaced 45° apart for maximum distinction.
 */
export const CHART_COLORS = [
  'oklch(0.72 0.14 250)', // blue (accent)
  'oklch(0.72 0.14 155)', // green (finances)
  'oklch(0.72 0.14 25)', // red (health)
  'oklch(0.72 0.14 60)', // yellow (journal)
  'oklch(0.72 0.14 290)', // purple (routine)
  'oklch(0.72 0.14 200)', // teal (objectives)
  'oklch(0.72 0.14 340)', // pink (people)
  'oklch(0.72 0.14 110)', // lime (assets)
  'oklch(0.72 0.14 85)', // amber (knowledge)
  'oklch(0.72 0.14 178)', // cyan (career)
  'oklch(0.72 0.14 310)', // magenta (legal)
  'oklch(0.72 0.14 45)', // orange (spirituality)
] as const;

/** Get a chart color by index (wraps around). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] as string;
}
