'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/sessionStore';
import { useMemo, useEffect, useState } from 'react';
import { loadSession, StoredSession } from '@/lib/persistence/SessionStorage';
import { MetricSnapshot } from '@/lib/metrics-engine/types';
import { Nudge } from '@/lib/coaching-system/types';
import { SessionConfig } from '@/lib/session/types';
import { TimelineChart } from '@/components/analytics/TimelineChart';
import { SpeakingTimeChart } from '@/components/analytics/SpeakingTimeChart';
import { EngagementHeatmap } from '@/components/analytics/EngagementHeatmap';
import { NudgeEffectivenessChart } from '@/components/analytics/NudgeEffectivenessChart';
import { StudentStateTimeline } from '@/components/analytics/StudentStateTimeline';

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionIdParam = params.sessionId as string;

  // Try in-memory store first, then fall back to IndexedDB
  const storeMetrics = useSessionStore((s) => s.metricsHistory);
  const storeNudges = useSessionStore((s) => s.nudgeHistory);
  const storeConfig = useSessionStore((s) => s.sessionConfig);
  const storeStartTime = useSessionStore((s) => s.startTime);
  const storeSessionId = useSessionStore((s) => s.sessionId);

  const [dbSession, setDbSession] = useState<StoredSession | null>(null);
  const hasInMemoryData = storeSessionId === sessionIdParam && storeMetrics.length > 0;
  const [loading, setLoading] = useState(!hasInMemoryData);

  useEffect(() => {
    if (hasInMemoryData) return;

    // Load from IndexedDB
    let cancelled = false;
    loadSession(sessionIdParam)
      .then((session) => {
        if (!cancelled) {
          setDbSession(session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionIdParam, hasInMemoryData]);

  // Resolve data source: in-memory or IndexedDB
  const getFullHistory = useSessionStore((s) => s.getFullHistory);
  const metricsHistory = useMemo<MetricSnapshot[]>(() => {
    if (hasInMemoryData) {
      // Combine archive + recent for full picture
      return getFullHistory();
    }
    return dbSession?.metricsHistory ?? [];
  }, [hasInMemoryData, getFullHistory, dbSession]);

  const nudgeHistory = useMemo<Nudge[]>(() =>
    hasInMemoryData ? storeNudges : dbSession?.nudgeHistory ?? [],
    [hasInMemoryData, storeNudges, dbSession]
  );

  const sessionConfig = useMemo<SessionConfig>(() =>
    hasInMemoryData
      ? storeConfig
      : dbSession?.config ?? { subject: '', sessionType: 'discussion', studentLevel: '', tutorName: 'Tutor', studentName: 'Student' },
    [hasInMemoryData, storeConfig, dbSession]
  );

  const startTime: number | null = hasInMemoryData
    ? storeStartTime
    : dbSession?.startTime ?? null;

  const summary = useMemo(() => {
    if (metricsHistory.length === 0) return null;

    const avgEngagement = metricsHistory.reduce((sum, m) => sum + m.engagementScore, 0) / metricsHistory.length;
    const avgTutorEye = metricsHistory.reduce((sum, m) => sum + m.tutor.eyeContactScore, 0) / metricsHistory.length;
    const avgStudentEye = metricsHistory.reduce((sum, m) => sum + m.student.eyeContactScore, 0) / metricsHistory.length;
    const lastMetrics = metricsHistory[metricsHistory.length - 1];
    const durationMs = lastMetrics.session.elapsedMs;

    const keyMoments: { time: number; type: string; description: string }[] = [];
    for (let i = 1; i < metricsHistory.length; i++) {
      const prev = metricsHistory[i - 1];
      const curr = metricsHistory[i];
      if (prev.engagementScore - curr.engagementScore > 15) {
        keyMoments.push({
          time: curr.session.elapsedMs,
          type: 'drop',
          description: `Engagement dropped from ${prev.engagementScore} to ${curr.engagementScore}`,
        });
      }
      if (curr.engagementScore - prev.engagementScore > 15) {
        keyMoments.push({
          time: curr.session.elapsedMs,
          type: 'peak',
          description: `Engagement peaked at ${curr.engagementScore}`,
        });
      }
    }

    const recommendations: string[] = [];
    if (lastMetrics.tutor.talkTimePercent > 0.7) {
      recommendations.push('Try incorporating more student-led discussions to improve balance');
    }
    if (avgStudentEye < 0.4) {
      recommendations.push('Student eye contact was low — consider more engaging visual content');
    }
    if (avgEngagement < 60) {
      recommendations.push('Overall engagement was below target — try shorter explanation segments');
    }
    if (lastMetrics.session.interruptionCount > 5) {
      recommendations.push('High interruption count — practice giving more wait time after questions');
    }

    // Student state-based recommendations
    const confusedSnapshots = metricsHistory.filter(m => m.studentState === 'confused').length;
    const strugglingSnapshots = metricsHistory.filter(m => m.studentState === 'struggling').length;
    const driftingSnapshots = metricsHistory.filter(m => m.studentState === 'drifting').length;
    const totalSnapshots = metricsHistory.length;

    if (confusedSnapshots / totalSnapshots > 0.15) {
      recommendations.push('Student showed signs of confusion frequently — consider checking understanding more often');
    }
    if (strugglingSnapshots / totalSnapshots > 0.1) {
      recommendations.push('Student appeared to struggle at times — try breaking concepts into smaller steps');
    }
    if (driftingSnapshots / totalSnapshots > 0.2) {
      recommendations.push('Attention drift was common — try more interactive exercises to maintain focus');
    }

    // Turn-taking recommendation
    const lastMetricsTT = metricsHistory[metricsHistory.length - 1];
    if (lastMetricsTT?.session?.turnCount !== undefined && lastMetricsTT.session.turnCount < 3 && metricsHistory.length > 60) {
      recommendations.push('Very few conversational turns — aim for more back-and-forth dialogue');
    }
    if (lastMetricsTT?.session?.turnTakingGapMs !== undefined && lastMetricsTT.session.turnTakingGapMs > 5000 && lastMetricsTT.session.turnCount > 3) {
      recommendations.push('Long pauses between speaker transitions — try encouraging quicker responses');
    }

    if (recommendations.length === 0) {
      recommendations.push('Great session! Engagement levels were consistently strong');
    }

    return {
      avgEngagement: Math.round(avgEngagement),
      avgTutorEye: Math.round(avgTutorEye * 100),
      avgStudentEye: Math.round(avgStudentEye * 100),
      talkTimeRatio: {
        tutor: Math.round(lastMetrics.tutor.talkTimePercent * 100),
        student: Math.round(lastMetrics.student.talkTimePercent * 100),
      },
      interruptions: lastMetrics.session.interruptionCount,
      durationMinutes: Math.round(durationMs / 60000),
      nudgesTriggered: nudgeHistory.length,
      keyMoments: keyMoments.slice(0, 5),
      recommendations,
      turnCount: lastMetrics.session.turnCount,
      avgTurnGapMs: lastMetrics.session.turnTakingGapMs,
    };
  }, [metricsHistory, nudgeHistory]);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading session data...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No session data available for {sessionIdParam}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Session Report</h1>
            <p className="text-gray-400 text-sm mt-1">
              {sessionConfig.subject} — {sessionConfig.sessionType} — {summary.durationMinutes} min
            </p>
            <p className="text-gray-600 text-xs mt-0.5 font-mono">{sessionIdParam}</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
          >
            New Session
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Engagement</p>
            <p className="text-2xl font-bold text-white">{summary.avgEngagement}</p>
            <p className="text-xs text-gray-600">avg score</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Duration</p>
            <p className="text-2xl font-bold text-white">{summary.durationMinutes}</p>
            <p className="text-xs text-gray-600">minutes</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Nudges</p>
            <p className="text-2xl font-bold text-white">{summary.nudgesTriggered}</p>
            <p className="text-xs text-gray-600">coaching tips</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Interruptions</p>
            <p className="text-2xl font-bold text-white">{summary.interruptions}</p>
            <p className="text-xs text-gray-600">detected</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Turn Count</p>
            <p className="text-2xl font-bold text-white">{summary.turnCount ?? 0}</p>
            <p className="text-xs text-gray-600">speaker switches</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Avg Turn Gap</p>
            <p className="text-2xl font-bold text-white">
              {summary.avgTurnGapMs ? `${(summary.avgTurnGapMs / 1000).toFixed(1)}s` : 'N/A'}
            </p>
            <p className="text-xs text-gray-600">response time</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Tutor Eye Contact</p>
            <p className="text-2xl font-bold text-white">{summary.avgTutorEye}%</p>
            <p className="text-xs text-gray-600">average</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Student Eye Contact</p>
            <p className="text-2xl font-bold text-white">{summary.avgStudentEye}%</p>
            <p className="text-xs text-gray-600">average</p>
          </div>
        </div>

        {/* Timeline chart */}
        {startTime && (
          <div className="mb-6">
            <TimelineChart metricsHistory={metricsHistory} startTime={startTime} />
          </div>
        )}

        {/* Student state timeline */}
        {startTime && metricsHistory.length > 10 && (
          <div className="mb-6">
            <StudentStateTimeline metricsHistory={metricsHistory} startTime={startTime} />
          </div>
        )}

        {/* Engagement heatmap */}
        {startTime && metricsHistory.length > 10 && (
          <div className="mb-6">
            <EngagementHeatmap metricsHistory={metricsHistory} startTime={startTime} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Speaking time chart */}
          <SpeakingTimeChart
            tutorPercent={summary.talkTimeRatio.tutor}
            studentPercent={summary.talkTimeRatio.student}
            tutorName={sessionConfig.tutorName}
            studentName={sessionConfig.studentName}
          />

          {/* Eye contact */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Eye Contact</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{sessionConfig.tutorName}</span>
                  <span className="text-white">{summary.avgTutorEye}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full">
                  <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${summary.avgTutorEye}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{sessionConfig.studentName}</span>
                  <span className="text-white">{summary.avgStudentEye}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full">
                  <div className="h-2 bg-purple-500 rounded-full transition-all" style={{ width: `${summary.avgStudentEye}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Speaking time */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Speaking Time</h3>
            <div className="flex h-8 rounded-lg overflow-hidden mb-2">
              <div
                className="bg-blue-500 flex items-center justify-center text-xs font-medium"
                style={{ width: `${summary.talkTimeRatio.tutor}%` }}
              >
                {summary.talkTimeRatio.tutor}%
              </div>
              <div
                className="bg-purple-500 flex items-center justify-center text-xs font-medium"
                style={{ width: `${summary.talkTimeRatio.student}%` }}
              >
                {summary.talkTimeRatio.student}%
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{sessionConfig.tutorName}</span>
              <span>{sessionConfig.studentName}</span>
            </div>
          </div>
        </div>

        {/* Nudge effectiveness */}
        {startTime && nudgeHistory.length > 0 && (
          <div className="mb-6">
            <NudgeEffectivenessChart
              metricsHistory={metricsHistory}
              nudgeHistory={nudgeHistory}
              startTime={startTime}
            />
          </div>
        )}

        {/* Key moments */}
        {summary.keyMoments.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Key Moments</h3>
            <div className="space-y-2">
              {summary.keyMoments.map((moment, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600 font-mono text-xs w-12">{formatTime(moment.time)}</span>
                  <span className={moment.type === 'drop' ? 'text-red-400' : 'text-green-400'}>
                    {moment.type === 'drop' ? '↓' : '↑'}
                  </span>
                  <span className="text-gray-300">{moment.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nudge history */}
        {nudgeHistory.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Coaching Nudges</h3>
            <div className="space-y-2">
              {nudgeHistory.map((nudge) => (
                <div key={nudge.id} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-600 font-mono text-xs w-12">
                    {startTime ? formatTime(nudge.timestamp - startTime) : ''}
                  </span>
                  <span>{nudge.icon}</span>
                  <span className="text-gray-300">{nudge.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Recommendations</h3>
          <ul className="space-y-2">
            {summary.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="text-blue-400 mt-0.5">-</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
