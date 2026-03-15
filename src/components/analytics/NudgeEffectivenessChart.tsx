'use client';

import { MetricSnapshot } from '@/lib/metrics-engine/types';
import { Nudge } from '@/lib/coaching-system/types';

interface NudgeEffectivenessChartProps {
  metricsHistory: MetricSnapshot[];
  nudgeHistory: Nudge[];
  startTime: number;
}

interface NudgeImpact {
  nudge: Nudge;
  timeSinceStart: number;
  engagementBefore: number;
  engagementAfter: number;
  delta: number;
  effective: boolean;
}

export function NudgeEffectivenessChart({ metricsHistory, nudgeHistory, startTime }: NudgeEffectivenessChartProps) {
  if (nudgeHistory.length === 0 || metricsHistory.length < 10) return null;

  const impacts: NudgeImpact[] = nudgeHistory.map((nudge) => {
    // Find engagement 30s before and 60s after nudge
    const beforeWindow = metricsHistory.filter(
      (m) => m.timestamp >= nudge.timestamp - 30000 && m.timestamp < nudge.timestamp
    );
    const afterWindow = metricsHistory.filter(
      (m) => m.timestamp > nudge.timestamp && m.timestamp <= nudge.timestamp + 60000
    );

    const avgBefore = beforeWindow.length > 0
      ? beforeWindow.reduce((s, m) => s + m.engagementScore, 0) / beforeWindow.length
      : 0;
    const avgAfter = afterWindow.length > 0
      ? afterWindow.reduce((s, m) => s + m.engagementScore, 0) / afterWindow.length
      : avgBefore;

    return {
      nudge,
      timeSinceStart: nudge.timestamp - startTime,
      engagementBefore: Math.round(avgBefore),
      engagementAfter: Math.round(avgAfter),
      delta: Math.round(avgAfter - avgBefore),
      effective: avgAfter > avgBefore,
    };
  });

  const effectiveCount = impacts.filter((i) => i.effective).length;
  const effectivenessRate = Math.round((effectiveCount / impacts.length) * 100);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Coaching Effectiveness</h3>
        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">
          {effectivenessRate}% effective
        </span>
      </div>
      <div className="space-y-2">
        {impacts.map((impact, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className="text-gray-600 font-mono w-10 flex-shrink-0">
              {formatTime(impact.timeSinceStart)}
            </span>
            <span className="flex-shrink-0">{impact.nudge.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 truncate">{impact.nudge.ruleId}</span>
                <span className={`font-mono flex-shrink-0 ${impact.delta > 0 ? 'text-green-400' : impact.delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {impact.delta > 0 ? '+' : ''}{impact.delta}
                </span>
              </div>
              {/* Mini bar showing before/after */}
              <div className="flex items-center gap-1 mt-1">
                <div className="h-1.5 bg-gray-700 rounded-full flex-1 overflow-hidden">
                  <div
                    className="h-full bg-gray-500 rounded-full"
                    style={{ width: `${impact.engagementBefore}%` }}
                  />
                </div>
                <span className="text-gray-600">→</span>
                <div className="h-1.5 bg-gray-700 rounded-full flex-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${impact.effective ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${impact.engagementAfter}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
