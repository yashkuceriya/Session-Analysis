'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MetricSnapshot } from '@/lib/metrics-engine/types';

interface ExpressionRadarChartProps {
  metricsHistory: MetricSnapshot[];
}

interface RadarDataPoint {
  name: string;
  tutor: number;
  student: number;
}

export function ExpressionRadarChart({ metricsHistory }: ExpressionRadarChartProps) {
  if (metricsHistory.length === 0) return null;

  // Compute average expression values
  let tutorAvg = {
    smile: 0,
    focus: 0,
    confusion: 0,
    surprise: 0,
    energy: 0,
    positivity: 0,
  };

  let studentAvg = {
    smile: 0,
    focus: 0,
    confusion: 0,
    surprise: 0,
    energy: 0,
    positivity: 0,
  };

  let tutorExpressionCount = 0;
  let studentExpressionCount = 0;

  metricsHistory.forEach((snapshot) => {
    if (snapshot.tutorExpression) {
      tutorAvg.smile += snapshot.tutorExpression.smile;
      tutorAvg.focus += snapshot.tutorExpression.concentration;
      tutorAvg.confusion += snapshot.tutorExpression.confusion;
      tutorAvg.surprise += snapshot.tutorExpression.surprise;
      tutorAvg.energy += snapshot.tutorExpression.energy;
      tutorAvg.positivity += snapshot.tutorExpression.valence;
      tutorExpressionCount++;
    }

    if (snapshot.studentExpression) {
      studentAvg.smile += snapshot.studentExpression.smile;
      studentAvg.focus += snapshot.studentExpression.concentration;
      studentAvg.confusion += snapshot.studentExpression.confusion;
      studentAvg.surprise += snapshot.studentExpression.surprise;
      studentAvg.energy += snapshot.studentExpression.energy;
      studentAvg.positivity += snapshot.studentExpression.valence;
      studentExpressionCount++;
    }
  });

  // Scale to 0-100
  if (tutorExpressionCount > 0) {
    tutorAvg.smile = Math.round((tutorAvg.smile / tutorExpressionCount) * 100);
    tutorAvg.focus = Math.round((tutorAvg.focus / tutorExpressionCount) * 100);
    tutorAvg.confusion = Math.round((tutorAvg.confusion / tutorExpressionCount) * 100);
    tutorAvg.surprise = Math.round((tutorAvg.surprise / tutorExpressionCount) * 100);
    tutorAvg.energy = Math.round((tutorAvg.energy / tutorExpressionCount) * 100);
    tutorAvg.positivity = Math.round((tutorAvg.positivity / tutorExpressionCount) * 100);
  }

  if (studentExpressionCount > 0) {
    studentAvg.smile = Math.round((studentAvg.smile / studentExpressionCount) * 100);
    studentAvg.focus = Math.round((studentAvg.focus / studentExpressionCount) * 100);
    studentAvg.confusion = Math.round((studentAvg.confusion / studentExpressionCount) * 100);
    studentAvg.surprise = Math.round((studentAvg.surprise / studentExpressionCount) * 100);
    studentAvg.energy = Math.round((studentAvg.energy / studentExpressionCount) * 100);
    studentAvg.positivity = Math.round((studentAvg.positivity / studentExpressionCount) * 100);
  }

  const data: RadarDataPoint[] = [
    { name: 'Smile', tutor: tutorAvg.smile, student: studentAvg.smile },
    { name: 'Focus', tutor: tutorAvg.focus, student: studentAvg.focus },
    { name: 'Confusion', tutor: tutorAvg.confusion, student: studentAvg.confusion },
    { name: 'Surprise', tutor: tutorAvg.surprise, student: studentAvg.surprise },
    { name: 'Energy', tutor: tutorAvg.energy, student: studentAvg.energy },
    { name: 'Positivity', tutor: tutorAvg.positivity, student: studentAvg.positivity },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-4">Expression Profile</h3>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <PolarGrid stroke="#475569" />
          <PolarAngleAxis
            dataKey="name"
            stroke="#64748b"
            fontSize={12}
            tick={(props: any) => <CustomAngleTick {...props} />}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            stroke="#64748b"
            fontSize={11}
          />
          <Radar
            name="Tutor"
            dataKey="tutor"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Radar
            name="Student"
            dataKey="student"
            stroke="#a855f7"
            fill="#a855f7"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Legend
            wrapperStyle={{
              fontSize: '12px',
              paddingTop: '16px',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomAngleTick({ x, y, payload }: any) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="fill-gray-300"
      fontSize={12}
    >
      {payload.value}
    </text>
  );
}
