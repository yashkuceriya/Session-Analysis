'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { MetricSnapshot, StudentState } from '@/lib/metrics-engine/types';

interface EmotionDistributionChartProps {
  metricsHistory: MetricSnapshot[];
}

interface DistributionDataPoint {
  name: string;
  value: number;
  percentage: number;
}

const STATE_COLORS: Record<StudentState, string> = {
  engaged: '#22c55e',
  passive: '#eab308',
  confused: '#f97316',
  drifting: '#ef4444',
  struggling: '#dc2626',
};

const STATE_LABELS: Record<StudentState, string> = {
  engaged: 'Engaged',
  passive: 'Passive',
  confused: 'Confused',
  drifting: 'Drifting',
  struggling: 'Struggling',
};

export function EmotionDistributionChart({ metricsHistory }: EmotionDistributionChartProps) {
  if (metricsHistory.length === 0) return null;

  // Count snapshots for each state
  const stateCounts: Record<StudentState, number> = {
    engaged: 0,
    passive: 0,
    confused: 0,
    drifting: 0,
    struggling: 0,
  };

  metricsHistory.forEach((snapshot) => {
    stateCounts[snapshot.studentState]++;
  });

  const total = metricsHistory.length;

  // Build data for pie chart
  const data: DistributionDataPoint[] = (
    Object.entries(stateCounts) as [StudentState, number][]
  )
    .filter(([, count]) => count > 0)
    .map(([state, count]) => ({
      name: STATE_LABELS[state],
      value: count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.value - a.value);

  // Find dominant state
  const dominantState = data.length > 0 ? data[0] : null;

  // Build natural language summary
  const summaryParts: string[] = [];
  if (dominantState) {
    summaryParts.push(
      `The student was mostly ${dominantState.name.toLowerCase()} (${dominantState.percentage}% of the session)`
    );
  }

  // Add secondary states
  const secondaryStates = data.slice(1, 3);
  if (secondaryStates.length > 0) {
    const stateDescriptions = secondaryStates.map((s) => `${s.name.toLowerCase()} (${s.percentage}%)`);
    if (stateDescriptions.length === 1) {
      summaryParts.push(`with brief periods of ${stateDescriptions[0]}`);
    } else {
      summaryParts.push(`with periods of ${stateDescriptions.join(' and ')}`);
    }
  }

  const summary = summaryParts.join(', ') + '.';

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-2 text-xs shadow-xl">
        <p className="text-[var(--foreground)] font-medium">{data.name}</p>
        <p className="text-[var(--muted)]">
          {data.value} snapshots ({data.percentage}%)
        </p>
      </div>
    );
  };

  const CustomLabel = ({ cx, cy }: any) => {
    if (!dominantState) return null;
    return (
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-[var(--foreground)] font-medium"
        fontSize={14}
      >
        {dominantState.name}
      </text>
    );
  };

  const PercentLabel = ({ cy }: any) => {
    if (!dominantState) return null;
    return (
      <text
        x="50%"
        y={cy + 8}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-[var(--muted)]"
        fontSize={12}
      >
        {dominantState.percentage}%
      </text>
    );
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">Student State Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
            label={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={STATE_COLORS[Object.keys(stateCounts)[
                  Object.values(stateCounts).indexOf(entry.value)
                ] as StudentState]}
              />
            ))}
          </Pie>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            fill="transparent"
            paddingAngle={2}
            dataKey="value"
            label={<CustomLabel />}
          />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            fill="transparent"
            paddingAngle={2}
            dataKey="value"
            label={<PercentLabel />}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom Legend */}
      <div className="mt-6 space-y-2">
        {data.map((item, index) => {
          const stateKey = Object.keys(stateCounts)[
            Object.values(stateCounts).indexOf(item.value)
          ] as StudentState;
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STATE_COLORS[stateKey] }}
              />
              <span className="text-[var(--foreground)]">
                {item.name}: <span className="font-medium">{item.percentage}%</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Natural Language Summary */}
      {dominantState && (
        <p className="mt-4 text-xs text-[var(--muted-light)] leading-relaxed italic">{summary}</p>
      )}
    </div>
  );
}
