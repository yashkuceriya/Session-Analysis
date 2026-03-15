'use client';

import { MetricSnapshot, StudentState } from '@/lib/metrics-engine/types';

interface StudentStateTimelineProps {
  metricsHistory: MetricSnapshot[];
  startTime: number;
}

const STATE_COLORS: Record<StudentState, string> = {
  engaged: 'bg-green-500',
  passive: 'bg-yellow-400',
  confused: 'bg-orange-400',
  drifting: 'bg-red-400',
  struggling: 'bg-red-600',
};

const STATE_LABELS: Record<StudentState, string> = {
  engaged: 'Engaged',
  passive: 'Passive',
  confused: 'Confused',
  drifting: 'Drifting',
  struggling: 'Struggling',
};

export function StudentStateTimeline({ metricsHistory, startTime }: StudentStateTimelineProps) {
  if (metricsHistory.length < 10) return null;

  // Group into 30-second segments with dominant state
  const segmentMs = 30000;
  const totalMs = metricsHistory[metricsHistory.length - 1].timestamp - startTime;
  const segmentCount = Math.ceil(totalMs / segmentMs);

  const segments: { state: StudentState; percentage: number }[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const segStart = startTime + i * segmentMs;
    const segEnd = segStart + segmentMs;
    const inSegment = metricsHistory.filter(
      (m) => m.timestamp >= segStart && m.timestamp < segEnd
    );

    if (inSegment.length > 0) {
      const states = inSegment.map(m => m.studentState).filter(Boolean);
      const counts: Record<string, number> = {};
      states.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
      const dominant = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'engaged') as StudentState;
      segments.push({ state: dominant, percentage: 100 / segmentCount });
    }
  }

  // Calculate state distribution
  const stateCounts: Partial<Record<StudentState, number>> = {};
  segments.forEach(s => { stateCounts[s.state] = (stateCounts[s.state] || 0) + 1; });
  const total = segments.length;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Student State Timeline</h3>

      {/* Timeline bar */}
      <div className="flex h-6 rounded-lg overflow-hidden mb-3">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`${STATE_COLORS[seg.state]} opacity-80 hover:opacity-100 transition-opacity`}
            style={{ width: `${seg.percentage}%` }}
            title={`${STATE_LABELS[seg.state]} (${Math.round(i * segmentMs / 60000)}:${String(Math.round((i * segmentMs % 60000) / 1000)).padStart(2, '0')})`}
          />
        ))}
      </div>

      {/* Time markers */}
      <div className="flex justify-between text-[10px] text-[var(--muted-light)] mb-4">
        <span>0:00</span>
        <span>{Math.round(totalMs / 60000)}:00</span>
      </div>

      {/* State distribution */}
      <div className="grid grid-cols-5 gap-2">
        {(['engaged', 'passive', 'confused', 'drifting', 'struggling'] as StudentState[]).map((state) => {
          const count = stateCounts[state] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={state} className="text-center">
              <div className={`w-3 h-3 rounded-full ${STATE_COLORS[state]} mx-auto mb-1 opacity-80`} />
              <p className="text-[10px] text-[var(--muted)]">{STATE_LABELS[state]}</p>
              <p className="text-xs text-[var(--foreground)] font-mono">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
