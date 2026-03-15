'use client';

import { MetricSnapshot } from '@/lib/metrics-engine/types';

interface EngagementHeatmapProps {
  metricsHistory: MetricSnapshot[];
  startTime: number;
}

function getHeatColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-emerald-400';
  if (score >= 40) return 'bg-yellow-400';
  if (score >= 20) return 'bg-orange-400';
  return 'bg-red-500';
}

function getHeatLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Critical';
}

export function EngagementHeatmap({ metricsHistory, startTime }: EngagementHeatmapProps) {
  if (metricsHistory.length < 2) return null;

  // Group metrics into 1-minute buckets
  const buckets: { minute: number; avgEngagement: number; avgEyeContact: number; avgEnergy: number; studentState: string }[] = [];
  const totalMinutes = Math.ceil(
    (metricsHistory[metricsHistory.length - 1].timestamp - startTime) / 60000
  );

  for (let m = 0; m < totalMinutes; m++) {
    const bucketStart = startTime + m * 60000;
    const bucketEnd = bucketStart + 60000;
    const inBucket = metricsHistory.filter(
      (snap) => snap.timestamp >= bucketStart && snap.timestamp < bucketEnd
    );

    if (inBucket.length > 0) {
      const avgEngagement = inBucket.reduce((s, v) => s + v.engagementScore, 0) / inBucket.length;
      const avgEyeContact = inBucket.reduce((s, v) => s + v.student.eyeContactScore, 0) / inBucket.length;
      const avgEnergy = inBucket.reduce((s, v) => s + v.student.energyScore, 0) / inBucket.length;
      // Most common student state in bucket
      const states = inBucket.map(s => s.studentState).filter(Boolean);
      const stateCounts: Record<string, number> = {};
      states.forEach(st => { stateCounts[st] = (stateCounts[st] || 0) + 1; });
      const dominantState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'engaged';

      buckets.push({
        minute: m,
        avgEngagement: Math.round(avgEngagement),
        avgEyeContact: Math.round(avgEyeContact * 100),
        avgEnergy: Math.round(avgEnergy * 100),
        studentState: dominantState,
      });
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Engagement Heatmap</h3>
      <p className="text-xs text-gray-500 mb-3">Each block = 1 minute. Hover for details.</p>
      <div className="flex flex-wrap gap-1">
        {buckets.map((bucket) => (
          <div key={bucket.minute} className="group relative">
            <div
              className={`w-8 h-8 rounded ${getHeatColor(bucket.avgEngagement)} opacity-80 hover:opacity-100 transition-opacity cursor-help flex items-center justify-center`}
            >
              <span className="text-[9px] font-bold text-white/80">{bucket.avgEngagement}</span>
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-xs whitespace-nowrap shadow-xl">
                <p className="text-gray-300 font-medium">Minute {bucket.minute + 1}</p>
                <p className="text-gray-400">Engagement: <span className="text-white">{bucket.avgEngagement}%</span></p>
                <p className="text-gray-400">Eye Contact: <span className="text-white">{bucket.avgEyeContact}%</span></p>
                <p className="text-gray-400">Energy: <span className="text-white">{bucket.avgEnergy}%</span></p>
                <p className="text-gray-400">State: <span className="text-white capitalize">{bucket.studentState}</span></p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-500">
        <span>Low</span>
        <div className="flex gap-0.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <div className="w-3 h-3 rounded bg-orange-400" />
          <div className="w-3 h-3 rounded bg-yellow-400" />
          <div className="w-3 h-3 rounded bg-emerald-400" />
          <div className="w-3 h-3 rounded bg-green-500" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
