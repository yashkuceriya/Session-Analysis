'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricSnapshot } from '@/lib/metrics-engine/types';

interface ExpressionTimelineChartProps {
  metricsHistory: MetricSnapshot[];
  startTime: number;
}

interface TimelineDataPoint {
  time: number;
  smile: number;
  focus: number;
  confusion: number;
  surprise: number;
  neutral: number;
}

export function ExpressionTimelineChart({
  metricsHistory,
  startTime,
}: ExpressionTimelineChartProps) {
  if (metricsHistory.length < 2) return null;

  // Downsample data (every 3rd point) and compute stacked areas
  const data: TimelineDataPoint[] = metricsHistory
    .filter((_, i) => i % 3 === 0)
    .map((m) => {
      const timeMinutes = Math.round((m.timestamp - startTime) / 60000 * 10) / 10;

      if (!m.studentExpression) {
        return {
          time: timeMinutes,
          smile: 0,
          focus: 0,
          confusion: 0,
          surprise: 0,
          neutral: 100,
        };
      }

      const smile = Math.round(m.studentExpression.smile * 100);
      const focus = Math.round(m.studentExpression.concentration * 100);
      const confusion = Math.round(m.studentExpression.confusion * 100);
      const surprise = Math.round(m.studentExpression.surprise * 100);

      // Neutral is 1 minus sum of others, capped at 0
      const sumOthers = smile + focus + confusion + surprise;
      const neutral = Math.max(0, Math.round(100 - sumOthers));

      return {
        time: timeMinutes,
        smile,
        focus,
        confusion,
        surprise,
        neutral,
      };
    });

  if (data.length < 2) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-gray-300 font-medium mb-1">Time: {data.time.toFixed(1)}m</p>
        <p className="text-green-400">Smile: {data.smile}%</p>
        <p className="text-blue-400">Focus: {data.focus}%</p>
        <p className="text-orange-400">Confusion: {data.confusion}%</p>
        <p className="text-yellow-400">Surprise: {data.surprise}%</p>
        <p className="text-gray-400">Neutral: {data.neutral}%</p>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-4">Student Expression Timeline</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="smileGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="confusionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="surpriseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="neutralGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            fontSize={11}
            tickFormatter={(v) => `${v}m`}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            domain={[0, 100]}
            label={{ value: '%', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="smile"
            stackId="1"
            stroke="#22c55e"
            fill="url(#smileGradient)"
            strokeWidth={1}
            name="Smile"
          />
          <Area
            type="monotone"
            dataKey="focus"
            stackId="1"
            stroke="#3b82f6"
            fill="url(#focusGradient)"
            strokeWidth={1}
            name="Focus"
          />
          <Area
            type="monotone"
            dataKey="confusion"
            stackId="1"
            stroke="#f97316"
            fill="url(#confusionGradient)"
            strokeWidth={1}
            name="Confusion"
          />
          <Area
            type="monotone"
            dataKey="surprise"
            stackId="1"
            stroke="#eab308"
            fill="url(#surpriseGradient)"
            strokeWidth={1}
            name="Surprise"
          />
          <Area
            type="monotone"
            dataKey="neutral"
            stackId="1"
            stroke="#6b7280"
            fill="url(#neutralGradient)"
            strokeWidth={1}
            name="Neutral"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
