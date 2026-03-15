'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SpeakingTimeChartProps {
  tutorPercent: number;
  studentPercent: number;
  tutorName: string;
  studentName: string;
}

export function SpeakingTimeChart({ tutorPercent, studentPercent, tutorName, studentName }: SpeakingTimeChartProps) {
  const data = [
    { name: tutorName, value: tutorPercent, fill: '#3b82f6' },
    { name: studentName, value: studentPercent, fill: '#a855f7' },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">Speaking Time Distribution</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="var(--muted)" fontSize={11} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} width={70} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--card-border)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--foreground)',
            }}
            formatter={(value) => [`${value}%`, 'Talk Time']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
