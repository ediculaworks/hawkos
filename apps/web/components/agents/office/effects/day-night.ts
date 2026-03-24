export interface DayNightOverlay {
  color: string;
  alpha: number;
}

/** Get day/night overlay based on current hour */
export function getDayNightOverlay(hour?: number): DayNightOverlay | null {
  const h = hour ?? new Date().getHours();
  const m = new Date().getMinutes();
  const t = h + m / 60; // Fractional hour

  // 06-08: Dawn (warm gold)
  if (t >= 6 && t < 8) {
    const progress = (t - 6) / 2; // 0 to 1
    return {
      color: '#ffcc44',
      alpha: 0.08 * (1 - progress), // Fading from 0.08 to 0
    };
  }

  // 08-17: Day (no overlay)
  if (t >= 8 && t < 17) {
    return null;
  }

  // 17-19: Dusk (warm orange)
  if (t >= 17 && t < 19) {
    const progress = (t - 17) / 2; // 0 to 1
    return {
      color: '#ff8844',
      alpha: 0.05 + 0.1 * progress, // 0.05 to 0.15
    };
  }

  // 19-22: Evening (blue-purple)
  if (t >= 19 && t < 22) {
    const progress = (t - 19) / 3; // 0 to 1
    return {
      color: '#2244aa',
      alpha: 0.1 + 0.1 * progress, // 0.1 to 0.2
    };
  }

  // 22-06: Night (dark blue)
  // At 22: alpha 0.2, at 02 (deepest): alpha 0.3, at 06: back to 0.2
  const nightProgress = t >= 22 ? (t - 22) / 4 : t < 2 ? (t + 2) / 4 : t < 6 ? 1 - (t - 2) / 4 : 0;
  return {
    color: '#112244',
    alpha: 0.2 + 0.1 * Math.min(nightProgress, 1),
  };
}
