'use client';

import { fetchLifeScore } from '@/lib/actions/life-score';
import { useQuery } from '@tanstack/react-query';

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;

  const color =
    score >= 75 ? 'var(--color-success)' :
    score >= 50 ? 'var(--color-accent)' :
    score >= 25 ? 'oklch(0.75 0.18 65)' :
    'var(--color-danger)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Life Score: ${score}`}>
        <title>Life Score</title>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-[var(--color-text-primary)]">{score}</span>
      </div>
    </div>
  );
}

export default function LifeScoreWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['life-score'],
    queryFn: fetchLifeScore,
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-[var(--space-3)]">
        <div className="w-20 h-20 rounded-full bg-[var(--color-surface-2)] animate-pulse" />
        <div className="w-24 h-2 rounded bg-[var(--color-surface-2)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-[var(--space-3)] p-[var(--space-2)]">
      <ScoreRing score={data.total} />
      <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Life Score</p>

      {/* Mini dimension bars */}
      <div className="w-full space-y-1">
        {data.dimensions.map((d) => (
          <div key={d.id} className="flex items-center gap-[var(--space-2)]">
            <span className="text-[9px] text-[var(--color-text-muted)] w-14 truncate">{d.label}</span>
            <div className="flex-1 h-1 rounded-full bg-[var(--color-surface-3)]">
              <div
                className="h-1 rounded-full transition-all duration-500"
                style={{ width: `${d.score}%`, backgroundColor: d.color }}
              />
            </div>
            <span className="text-[9px] font-mono text-[var(--color-text-muted)] w-6 text-right">
              {d.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
