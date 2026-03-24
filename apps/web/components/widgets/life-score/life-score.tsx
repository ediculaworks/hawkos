'use client';

// Placeholder: Life Score will be calculated from real data in future
// For now, shows a visual skeleton that's ready for real data integration
export default function LifeScoreWidget() {
  // TODO: Replace with real server action fetching computed scores
  const score = null;

  if (!score) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-[var(--space-3)]">
        <div className="relative">
          <svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label="Life Score">
            <title>Life Score</title>
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="var(--color-surface-3)"
              strokeWidth="5"
            />
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="5"
              strokeDasharray={`${0.65 * 2 * Math.PI * 35} ${2 * Math.PI * 35}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              className="transition-all duration-[var(--duration-slow)]"
              opacity={0.3}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-semibold text-[var(--color-text-muted)]">—</span>
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] text-center">
          Life Score será calculado com dados reais
        </p>
      </div>
    );
  }
}
