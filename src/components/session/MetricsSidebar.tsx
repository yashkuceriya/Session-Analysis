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

const STATE_DESCRIPTION: Record<string, string> = {
  engaged: 'Actively participating',
  passive: 'Listening but quiet',
  confused: 'May need clarification',
  drifting: 'Attention fading',
  struggling: 'Having difficulty',
};

const EXPRESSION_EMOJI: Record<string, string> = {
  smile: '😊',
  concentration: '🎯',
  confusion: '😕',
  surprise: '😮',
  energy: '⚡',
};

const EXPRESSION_LABEL: Record<string, string> = {
  smile: 'Smile',
  concentration: 'Focus',
  confusion: 'Confused',
  surprise: 'Surprised',
  energy: 'Energy',
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

  const trendNL = (trend: string) => {
    switch (trend) {
      case 'rising': return 'trending up';
      case 'declining': return 'declining';
      default: return 'holding steady';
    }
  };

  const engagementNL = (score: number): string => {
    if (score >= 70) return 'Engagement is strong';
    if (score >= 40) return 'Engagement is moderate';
    return 'Engagement needs attention';
  };

  const getMetricQuality = (score: number): string => {
    if (score > 70) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Low';
  };

  const getSpeakingTimeNL = (tutorPercent: number): string => {
    if (Math.abs(tutorPercent - 0.5) < 0.1) return 'Well balanced';
    if (tutorPercent > 0.6) return 'Tutor-heavy';
    return 'Student-heavy';
  };

  const getInterruptionNL = (count: number): string => {
    if (count === 0) return 'None';
    if (count <= 3) return 'Minimal';
    return 'Frequent';
  };

  const getTurnGapNL = (gapMs: number): string => {
    if (gapMs <= 2000) return 'Quick exchanges';
    if (gapMs <= 5000) return 'Normal pace';
    return 'Slow responses';
  };

  const getTopExpressions = () => {
    if (!metrics?.studentExpression) return [];

    const expressions = [
      { key: 'smile', value: metrics.studentExpression.smile },
      { key: 'concentration', value: metrics.studentExpression.concentration },
      { key: 'confusion', value: metrics.studentExpression.confusion },
      { key: 'surprise', value: metrics.studentExpression.surprise },
      { key: 'energy', value: metrics.studentExpression.energy },
    ];

    return expressions
      .filter((e) => e.value > 0.1)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  };

  const getExpressionNL = () => {
    const topExpressions = getTopExpressions();
    if (topExpressions.length === 0) return '';

    const top = topExpressions[0];
    if (top.key === 'concentration' && top.value > 0.5) return 'Student appears focused and engaged';
    if (top.key === 'confusion' && top.value > 0.5) return 'Student seems confused or uncertain';
    if (top.key === 'smile' && top.value > 0.5) return 'Student appears positive and engaged';
    if (top.key === 'energy' && top.value > 0.5) return 'Student shows high energy level';
    if (top.key === 'surprise' && top.value > 0.5) return 'Student appears surprised or interested';

    return '';
  };

  return (
    <div className="w-72 bg-gray-900/90 border-l border-gray-800 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Live Metrics</h2>
        <LatencyIndicator />
      </div>

      {!metrics ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-500 text-sm text-center">Waiting for data...</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Engagement Section */}
          <div className="flex flex-col items-center">
            <ProgressRing
              value={metrics.engagementScore}
              size={100}
              strokeWidth={8}
              label="Engagement"
            />
            <p className="text-[11px] text-gray-500 italic text-center mt-2">
              {engagementNL(metrics.engagementScore)}
            </p>
            <span className={`text-xs mt-1 ${trendColor(metrics.session.engagementTrend)}`}>
              {trendArrow(metrics.session.engagementTrend)} {trendNL(metrics.session.engagementTrend)}
            </span>
          </div>

          <div className="border-t border-gray-800/50" />

          {/* Student State Section */}
          {metrics.studentState && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                <span className="text-sm">{STATE_EMOJI[metrics.studentState] || '❓'}</span>
                <span className={`text-sm font-medium capitalize ${STATE_COLOR[metrics.studentState] || 'text-gray-400'}`}>
                  {metrics.studentState}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 italic text-center">
                {STATE_DESCRIPTION[metrics.studentState] || ''}
              </p>
            </div>
          )}

          <div className="border-t border-gray-800/50" />

          {/* Live Expression Panel */}
          <div>
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Student Expressions</h3>
            {!metrics.studentExpression ? (
              <p className="text-[11px] text-gray-500 text-center py-2">No face detected</p>
            ) : (
              <div className="space-y-2">
                {getTopExpressions().length > 0 ? (
                  <>
                    {getTopExpressions().map((expr) => (
                      <div key={expr.key} className="flex items-center gap-2">
                        <span className="text-sm">{EXPRESSION_EMOJI[expr.key]}</span>
                        <span className="text-[10px] text-gray-400 min-w-[50px]">
                          {EXPRESSION_LABEL[expr.key]}
                        </span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                            style={{ width: `${expr.value * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 min-w-[28px] text-right">
                          {Math.round(expr.value * 100)}%
                        </span>
                      </div>
                    ))}
                    {getExpressionNL() && (
                      <p className="text-[11px] text-gray-500 italic text-center pt-1 border-t border-gray-800/30">
                        {getExpressionNL()}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-gray-500 text-center py-2">No expressions detected</p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-800/50" />

          {/* Individual metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center">
              <ProgressRing
                value={metrics.tutor.eyeContactScore * 100}
                size={64}
                strokeWidth={5}
                label="Tutor Gaze"
                sublabel={trendArrow(metrics.tutor.eyeContactTrend)}
              />
              <p className="text-[11px] text-gray-500 italic text-center mt-1">
                {getMetricQuality(metrics.tutor.eyeContactScore * 100)}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <ProgressRing
                value={metrics.student.eyeContactScore * 100}
                size={64}
                strokeWidth={5}
                label="Student Gaze"
                sublabel={trendArrow(metrics.student.eyeContactTrend)}
              />
              <p className="text-[11px] text-gray-500 italic text-center mt-1">
                {getMetricQuality(metrics.student.eyeContactScore * 100)}
              </p>
            </div>
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

          <div className="border-t border-gray-800/50" />

          {/* Speaking time bar */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Speaking Time</p>
            <div className="flex h-4 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${metrics.tutor.talkTimePercent * 100}%` }}
              />
              <div
                className="bg-purple-500 transition-all duration-500"
                style={{ width: `${metrics.student.talkTimePercent * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>Tutor {Math.round(metrics.tutor.talkTimePercent * 100)}%</span>
              <span>Student {Math.round(metrics.student.talkTimePercent * 100)}%</span>
            </div>
            <p className="text-[11px] text-gray-500 italic text-center mt-1">
              {getSpeakingTimeNL(metrics.tutor.talkTimePercent)}
            </p>
          </div>

          <div className="border-t border-gray-800/50" />

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Interruptions</span>
                <span className="text-sm text-white font-mono">{metrics.session.interruptionCount}</span>
              </div>
              <p className="text-[11px] text-gray-500 italic">
                {getInterruptionNL(metrics.session.interruptionCount)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Turn Count</span>
                <span className="text-sm text-white font-mono">{metrics.session.turnCount ?? 0}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Avg Turn Gap</span>
                <span className="text-sm text-white font-mono">
                  {metrics.session.turnTakingGapMs > 0
                    ? `${(metrics.session.turnTakingGapMs / 1000).toFixed(1)}s`
                    : '-'}
                </span>
              </div>
              {metrics.session.turnTakingGapMs > 0 && (
                <p className="text-[11px] text-gray-500 italic">
                  {getTurnGapNL(metrics.session.turnTakingGapMs)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Attention Drift</span>
                <span className={`text-sm font-mono ${metrics.session.attentionDriftDetected ? 'text-red-400' : 'text-green-400'}`}>
                  {metrics.session.attentionDriftDetected ? 'Detected' : 'None'}
                </span>
              </div>
              {metrics.session.attentionDriftDetected && (
                <p className="text-[11px] text-red-400 italic">
                  Stay alert
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
