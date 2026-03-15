'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MetricSnapshot } from '@/lib/metrics-engine/types';

interface TimelineChartProps {
  metricsHistory: MetricSnapshot[];
  startTime: number;
}

export function TimelineChart({ metricsHistory, startTime }: TimelineChartProps) {
  const data = metricsHistory
    .filter((_, i) => i % 2 === 0) // Downsample for perf
    .map((m) => ({
      time: Math.round((m.timestamp - startTime) / 60000 * 10) / 10, // minutes
      engagement: m.engagementScore,
      tutorEye: Math.round(m.tutor.eyeContactScore * 100),
      studentEye: Math.round(m.student.eyeContactScore * 100),
      tutorEnergy: Math.round(m.tutor.energyScore * 100),
      studentEnergy: Math.round(m.student.energyScore * 100),
    }));

  if (data.length < 2) return null;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">Engagement Over Time</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis
            dataKey="time"
            stroke="var(--muted)"
            fontSize={11}
            tickFormatter={(v) => `${v}m`}
          />
          <YAxis stroke="var(--muted)" fontSize={11} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--card-border)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--foreground)',
            }}
            labelFormatter={(v) => `${v} min`}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          />
          <Line
            type="monotone"
            dataKey="engagement"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Engagement"
          />
          <Line
            type="monotone"
            dataKey="tutorEye"
            stroke="#22c55e"
            strokeWidth={1}
            dot={false}
            name="Tutor Eye Contact"
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="studentEye"
            stroke="#a855f7"
            strokeWidth={1}
            dot={false}
            name="Student Eye Contact"
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
