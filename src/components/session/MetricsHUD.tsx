'use client';

import { useState, useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';

interface MetricsHUDProps {
  visible: boolean;
}

export function MetricsHUD({ visible }: MetricsHUDProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentMetrics = useSessionStore((s) => s.currentMetrics);
  const startTime = useSessionStore((s) => s.startTime);
  const [sessionDuration, setSessionDuration] = useState('0:00');

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setSessionDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (!currentMetrics) return (
    <div
      className={`fixed top-4 right-4 z-35 transition-all duration-300 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="bg-gray-900/70 backdrop-blur-md rounded-xl p-4 shadow-lg border border-gray-700/50 w-52">
        <p className="text-sm text-gray-400 animate-pulse">Analyzing...</p>
      </div>
    </div>
  );

  const engagementScore = currentMetrics.engagementScore;
  const studentState = currentMetrics.studentState;
  const turnCount = currentMetrics.session.turnCount;
  const turnGapMs = currentMetrics.session.turnTakingGapMs;
  const tutorEyeContact = currentMetrics.tutor.eyeContactScore;
  const studentEyeContact = currentMetrics.student.eyeContactScore;

  const getEngagementColor = (score: number) => {
    if (score > 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStateEmoji = (state: string) => {
    const emojis: Record<string, string> = {
      engaged: '✓',
      passive: '😐',
      confused: '🤔',
      drifting: '💤',
      struggling: '😰',
    };
    return emojis[state] || '?';
  };

  const getStateLabel = (state: string) => {
    return state.charAt(0).toUpperCase() + state.slice(1);
  };

  const turnGapSeconds = (turnGapMs / 1000).toFixed(1);

  return (
    <div
      className={`fixed top-4 right-4 z-35 transition-all duration-300 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}
    >
      {isCollapsed ? (
        // Collapsed view - just engagement score
        <button
          onClick={() => setIsCollapsed(false)}
          className={`${getEngagementColor(engagementScore)} text-2xl font-bold bg-gray-900/70 backdrop-blur-md rounded-xl p-4 hover:bg-gray-900/90 transition-all`}
        >
          {engagementScore}
        </button>
      ) : (
        // Expanded view
        <div className="bg-gray-900/70 backdrop-blur-md rounded-xl p-4 shadow-lg border border-gray-700/50 space-y-3 w-52">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Metrics</h3>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Collapse HUD"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </div>

          {/* Engagement Score */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Engagement</p>
            <p className={`${getEngagementColor(engagementScore)} text-3xl font-bold`}>{engagementScore}</p>
          </div>

          {/* Student State */}
          <div>
            <p className="text-xs text-gray-400 mb-1">State</p>
            <p className="text-white text-sm font-medium">
              {getStateEmoji(studentState)} {getStateLabel(studentState)}
            </p>
          </div>

          {/* Turn Count */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-400">Turns</p>
              <p className="text-white text-lg font-semibold">{turnCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Gap (s)</p>
              <p className="text-white text-lg font-semibold">{turnGapSeconds}</p>
            </div>
          </div>

          {/* Session Duration */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Duration</p>
            <p className="text-white text-sm font-mono">{sessionDuration}</p>
          </div>

          {/* Eye Contact Bars */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Eye Contact</p>

            <div>
              <p className="text-xs text-gray-500 mb-1">Tutor</p>
              <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${tutorEyeContact * 100}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Student</p>
              <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all duration-300"
                  style={{ width: `${studentEyeContact * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
