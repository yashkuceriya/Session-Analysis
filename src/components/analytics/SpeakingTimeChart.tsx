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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-4">Speaking Time Distribution</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={70} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
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
