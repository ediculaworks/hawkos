'use client';

import { ExerciseProgress } from '@/components/health/exercise-progress';
import { PersonalRecords } from '@/components/health/personal-records';

export default function TreinosTab() {
  return (
    <div className="space-y-[var(--space-6)]">
      <ExerciseProgress />
      <PersonalRecords />
    </div>
  );
}
