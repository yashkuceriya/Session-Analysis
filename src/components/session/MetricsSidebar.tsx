'use client';

import { useSessionStore } from '@/stores/sessionStore';
import { ProgressRing } from '../ui/ProgressRing';
import { LatencyIndicator } from './LatencyIndicator';

const STATE_EMOJI: Record<string, string> = {
  engaged: '✅',
  passive: '😐',
  confused: '🤔',
  drifting: '💤',
  struggling: '😰',
};

const STATE_COLOR: Record<string, string> = {
  engaged: 'text-green-400',
  passive: 'text-yellow-400',
  confused: 'text-orange-400',
  drifting: 'text-red-400',
  struggling: 'text-red-500',
};

export function MetricsSidebar() {
  const metrics = useSessionStore((s) => s.currentMetrics);
  const isSidebarOpen = useSessionStore((s) => s.isSidebarOpen);

  if (!isSidebarOpen) return null;

  const trendArrow = (trend: string) => {
    switch (trend) {
      case 'rising': return '↑';
      case 'declining': return '↓';
      default: return '→';
    }
  };

  const trendColor = (trend: string) => {
    switch (trend) {
      case 'rising': return 'text-green-400';
      case 'declining': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Live Metrics</h2>
        <LatencyIndicator />
      </div>

      {!metrics ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-500 text-sm text-center">Waiting for data...</p>
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Overall engagement */}
          <div className="flex flex-col items-center">
            <ProgressRing
              value={metrics.engagementScore}
              size={100}
              strokeWidth={8}
              label="Engagement"
            />
            <span className={`text-xs mt-1 ${trendColor(metrics.session.engagementTrend)}`}>
              {trendArrow(metrics.session.engagementTrend)} {metrics.session.engagementTrend}
            </span>
          </div>

          {/* Student State */}
          {metrics.studentState && (
            <div className="flex items-center justify-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
              <span className="text-sm">{STATE_EMOJI[metrics.studentState] || '❓'}</span>
              <span className={`text-sm font-medium capitalize ${STATE_COLOR[metrics.studentState] || 'text-gray-400'}`}>
                {metrics.studentState}
              </span>
            </div>
          )}

          {/* Individual metrics */}
          <div className="grid grid-cols-2 gap-3">
            <ProgressRing
              value={metrics.tutor.eyeContactScore * 100}
              size={64}
              strokeWidth={5}
              label="Tutor Eye"
              sublabel={trendArrow(metrics.tutor.eyeContactTrend)}
            />
            <ProgressRing
              value={metrics.student.eyeContactScore * 100}
              size={64}
              strokeWidth={5}
              label="Student Eye"
              sublabel={trendArrow(metrics.student.eyeContactTrend)}
            />
            <ProgressRing
              value={metrics.tutor.energyScore * 100}
              size={64}
              strokeWidth={5}
              label="Tutor Energy"
            />
            <ProgressRing
              value={metrics.student.energyScore * 100}
              size={64}
              strokeWidth={5}
              label="Student Energy"
            />
          </div>

          {/* Speaking time bar */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Speaking Time</p>
            <div className="flex h-4 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${(metrics.tutor.talkTimePercent) * 100}%` }}
              />
              <div
                className="bg-purple-500 transition-all duration-500"
                style={{ width: `${(metrics.student.talkTimePercent) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>Tutor {Math.round(metrics.tutor.talkTimePercent * 100)}%</span>
              <span>Student {Math.round(metrics.student.talkTimePercent * 100)}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Interruptions</span>
              <span className="text-sm text-white font-mono">{metrics.session.interruptionCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Turn Count</span>
              <span className="text-sm text-white font-mono">{metrics.session.turnCount ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Avg Turn Gap</span>
              <span className="text-sm text-white font-mono">
                {metrics.session.turnTakingGapMs > 0
                  ? `${(metrics.session.turnTakingGapMs / 1000).toFixed(1)}s`
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Attention Drift</span>
              <span className={`text-sm font-mono ${metrics.session.attentionDriftDetected ? 'text-red-400' : 'text-green-400'}`}>
                {metrics.session.attentionDriftDetected ? 'Detected' : 'None'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
