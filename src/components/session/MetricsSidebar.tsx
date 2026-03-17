'use client';

import { useSessionStore } from '@/stores/sessionStore';
import { ProgressRing } from '../ui/ProgressRing';
import { LatencyIndicator } from './LatencyIndicator';
import { useEffect, useState } from 'react';

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
  const metricsHistory = useSessionStore((s) => s.metricsHistory);
  const isSidebarOpen = useSessionStore((s) => s.isSidebarOpen);
  const startTime = useSessionStore((s) => s.startTime);
  const [elapsed, setElapsed] = useState('0:00');

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const ms = Date.now() - startTime;
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

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

  // Mini sparkline from recent history
  const recentScores = metricsHistory.slice(-20).map((m) => m.engagementScore);

  const formatFocusStreak = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <div className="w-full bg-gray-900/90 border-l border-gray-800 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-sm">AI Analytics</h2>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{elapsed}</span>
        </div>
        <LatencyIndicator />
      </div>

      {!metrics ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Analyzing session...</p>
          </div>
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

          {/* Mini Sparkline */}
          {recentScores.length > 3 && (
            <div className="px-1">
              <svg width="100%" height="28" viewBox={`0 0 ${recentScores.length * 10} 28`} preserveAspectRatio="none">
                <polyline
                  points={recentScores.map((s, i) => `${i * 10},${28 - (s / 100) * 26}`).join(' ')}
                  fill="none"
                  stroke="rgba(99, 102, 241, 0.6)"
                  strokeWidth="1.5"
                />
                {recentScores.length > 0 && (
                  <circle
                    cx={(recentScores.length - 1) * 10}
                    cy={28 - (recentScores[recentScores.length - 1] / 100) * 26}
                    r="2.5"
                    fill="#6366f1"
                  />
                )}
              </svg>
            </div>
          )}

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

          {/* Live Speaking Indicator */}
          <div className="flex items-center gap-2 bg-gray-800/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 flex-1">
              <div className={`w-2 h-2 rounded-full ${metrics.tutor.isSpeaking ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-[11px] text-gray-400">Tutor</span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <span className="text-[11px] text-gray-400">Student</span>
              <div className={`w-2 h-2 rounded-full ${metrics.student.isSpeaking ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} />
            </div>
          </div>

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
                  <p className="text-[11px] text-gray-500 text-center py-2">Neutral expression</p>
                )}

                {/* Additional expression signals */}
                {(metrics.studentExpression.frustration !== undefined || metrics.studentExpression.interest !== undefined) && (
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-800/30">
                    {metrics.studentExpression.interest !== undefined && metrics.studentExpression.interest > 0.1 && (
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500">Interest</p>
                        <p className="text-sm font-medium text-cyan-400">{Math.round(metrics.studentExpression.interest * 100)}%</p>
                      </div>
                    )}
                    {metrics.studentExpression.frustration !== undefined && metrics.studentExpression.frustration > 0.1 && (
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500">Frustration</p>
                        <p className="text-sm font-medium text-orange-400">{Math.round(metrics.studentExpression.frustration * 100)}%</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Head gestures */}
                {(metrics.studentExpression.headNod > 0.3 || metrics.studentExpression.headShake > 0.3) && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-1">
                    {metrics.studentExpression.headNod > 0.3 && (
                      <span className="bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">Nodding</span>
                    )}
                    {metrics.studentExpression.headShake > 0.3 && (
                      <span className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full">Shaking head</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-800/50" />

          {/* Eye Contact & Energy — 2x2 grid */}
          <div>
            <h3 className="text-xs font-semibold text-gray-300 mb-3">Gaze & Energy</h3>
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
          </div>

          <div className="border-t border-gray-800/50" />

          {/* Speaking time bar */}
          <div>
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Speaking Time</h3>
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

          {/* Voice quality */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/30 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500">Speech Rate</p>
              <p className="text-sm font-mono text-white">{Math.round(metrics.student.speechRate * 100)}%</p>
            </div>
            <div className="bg-gray-800/30 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500">Pitch Variance</p>
              <p className="text-sm font-mono text-white">{metrics.student.pitchVariance.toFixed(2)}</p>
              <p className="text-[9px] text-gray-600">{metrics.student.pitchVariance > 0.3 ? 'Expressive' : metrics.student.pitchVariance > 0.1 ? 'Normal' : 'Monotone'}</p>
            </div>
          </div>

          <div className="border-t border-gray-800/50" />

          {/* Attention & Focus */}
          <div>
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Attention & Focus</h3>
            <div className="space-y-2">
              {/* Distraction score */}
              {metrics.student.distractionScore !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 min-w-[70px]">Distraction</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        metrics.student.distractionScore > 0.5 ? 'bg-red-500' : metrics.student.distractionScore > 0.25 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${metrics.student.distractionScore * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 min-w-[28px] text-right">
                    {Math.round(metrics.student.distractionScore * 100)}%
                  </span>
                </div>
              )}

              {/* Gaze deviation */}
              {metrics.student.gazeDeviation !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 min-w-[70px]">Gaze Off-Center</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                      style={{ width: `${metrics.student.gazeDeviation * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 min-w-[28px] text-right">
                    {Math.round(metrics.student.gazeDeviation * 100)}%
                  </span>
                </div>
              )}

              {/* Focus streak & distraction events */}
              <div className="grid grid-cols-3 gap-2 mt-1">
                {metrics.session.focusStreakMs !== undefined && (
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500">Focus Streak</p>
                    <p className="text-sm font-mono text-green-400">{formatFocusStreak(metrics.session.focusStreakMs)}</p>
                  </div>
                )}
                {metrics.session.distractionEvents !== undefined && (
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500">Distractions</p>
                    <p className={`text-sm font-mono ${metrics.session.distractionEvents > 5 ? 'text-red-400' : 'text-white'}`}>
                      {metrics.session.distractionEvents}
                    </p>
                  </div>
                )}
                {metrics.student.blinkRate !== undefined && (
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500">Blink Rate</p>
                    <p className="text-sm font-mono text-white">{Math.round(metrics.student.blinkRate)}/m</p>
                  </div>
                )}
              </div>

              {/* Head movement & posture */}
              <div className="flex items-center gap-3 mt-1">
                {metrics.student.headMovement !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">Movement:</span>
                    <span className={`text-[10px] font-medium ${
                      metrics.student.headMovement > 0.5 ? 'text-yellow-400' : 'text-gray-400'
                    }`}>
                      {metrics.student.headMovement > 0.5 ? 'Restless' : metrics.student.headMovement > 0.2 ? 'Normal' : 'Still'}
                    </span>
                  </div>
                )}
                {metrics.student.posture && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">Posture:</span>
                    <span className={`text-[10px] font-medium capitalize ${
                      metrics.student.posture === 'upright' ? 'text-green-400' :
                      metrics.student.posture === 'leaning' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {metrics.student.posture}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800/50" />

          {/* Session Stats */}
          <div>
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Session Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Interruptions</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-mono">{metrics.session.interruptionCount}</span>
                  <span className="text-[10px] text-gray-600">{getInterruptionNL(metrics.session.interruptionCount)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Turn Count</span>
                <span className="text-sm text-white font-mono">{metrics.session.turnCount ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Avg Turn Gap</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-mono">
                    {metrics.session.turnTakingGapMs > 0
                      ? `${(metrics.session.turnTakingGapMs / 1000).toFixed(1)}s`
                      : '-'}
                  </span>
                  {metrics.session.turnTakingGapMs > 0 && (
                    <span className="text-[10px] text-gray-600">{getTurnGapNL(metrics.session.turnTakingGapMs)}</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Silence</span>
                <span className="text-sm text-white font-mono">
                  {metrics.session.silenceDurationCurrent > 0
                    ? `${Math.round(metrics.session.silenceDurationCurrent / 1000)}s`
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
        </div>
      )}
    </div>
  );
}
