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
import { AIAnalysis } from '@/components/analytics/AIAnalysis';
import { NudgeEffectivenessChart } from '@/components/analytics/NudgeEffectivenessChart';
import { StudentStateTimeline } from '@/components/analytics/StudentStateTimeline';
import { SessionNarrativeSummary } from '@/components/analytics/SessionNarrativeSummary';
import { ExpressionRadarChart } from '@/components/analytics/ExpressionRadarChart';
import { EmotionDistributionChart } from '@/components/analytics/EmotionDistributionChart';
import { ExpressionTimelineChart } from '@/components/analytics/ExpressionTimelineChart';
import { FacialExpressionCard } from '@/components/analytics/FacialExpressionCard';

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
  const [dataSource, setDataSource] = useState<'memory' | 'server' | 'local' | null>(hasInMemoryData ? 'memory' : null);

  useEffect(() => {
    if (hasInMemoryData) return;

    let cancelled = false;

    // Try server API first
    fetch(`/api/sessions/${sessionIdParam}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        if (data.session && data.metrics?.length > 0) {
          // Convert server format to StoredSession
          setDbSession({
            id: data.session.id,
            config: data.session.config,
            startTime: new Date(data.session.start_time).getTime(),
            endTime: data.session.end_time ? new Date(data.session.end_time).getTime() : null,
            status: data.session.status,
            metricsHistory: data.metrics,
            nudgeHistory: data.nudges || [],
          });
          setDataSource('server');
          setLoading(false);
          return;
        }
        throw new Error('no server data');
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to IndexedDB
        loadSession(sessionIdParam)
          .then((session) => {
            if (!cancelled) {
              setDbSession(session);
              setDataSource(session ? 'local' : null);
              setLoading(false);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setDataSource(null);
              setLoading(false);
            }
          });
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

  const getEngagementQuality = (score: number): string => {
    if (score >= 75) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 45) return 'Fair';
    return 'Needs attention';
  };

  const getTurnsQuality = (turns: number): string => {
    if (turns >= 10) return 'Active dialogue';
    if (turns >= 5) return 'Good exchange';
    return 'Limited interaction';
  };

  const getEyeContactQuality = (pct: number): string => {
    if (pct >= 70) return 'Strong focus';
    if (pct >= 50) return 'Moderate';
    return 'Low attention';
  };

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinuteTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins === 0) return `${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading session data...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--muted)] mb-4">No session data available for {sessionIdParam}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">Session Report</h1>
            <p className="text-[var(--muted)] text-sm mt-2">
              {sessionConfig.subject} — {sessionConfig.sessionType} — {summary.durationMinutes} min
            </p>
            <p className="text-[var(--muted-light)] text-xs mt-1 font-mono">{sessionIdParam}</p>

            {/* Data provenance badge */}
            <div className="flex items-center gap-3 mt-3">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                dataSource === 'server' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                dataSource === 'memory' ? 'bg-[var(--info-light)] text-[var(--info)]' :
                dataSource === 'local' ? 'bg-[var(--warning-light)] text-[var(--warning)]' :
                'bg-[var(--card-hover)] text-[var(--muted)]'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {dataSource === 'server' ? 'Synced' :
                 dataSource === 'memory' ? 'Live session' :
                 dataSource === 'local' ? 'Local only' :
                 'Unknown source'}
              </span>
              <span className="text-[var(--muted-light)] text-xs">
                {metricsHistory.length} data points at ~{metricsHistory.length > 1 ? Math.round((metricsHistory[metricsHistory.length-1].timestamp - metricsHistory[0].timestamp) / metricsHistory.length / 100) / 10 : 0}s intervals
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium"
          >
            New Session
          </button>
        </div>

        {/* SESSION NARRATIVE SUMMARY */}
        {startTime && (
          <div className="mb-8">
            <SessionNarrativeSummary
              metricsHistory={metricsHistory}
              nudgeHistory={nudgeHistory}
              sessionConfig={sessionConfig}
              startTime={startTime}
            />
          </div>
        )}

        {/* QUICK STATS */}
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
            Quick Stats
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Engagement */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[var(--muted-light)] font-medium">Engagement</p>
                <p className="text-lg font-bold text-[var(--foreground)]">{summary.avgEngagement}</p>
              </div>
              <div className="h-1 bg-[var(--card-hover)] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${
                    summary.avgEngagement >= 75 ? 'bg-green-500' :
                    summary.avgEngagement >= 60 ? 'bg-blue-500' :
                    summary.avgEngagement >= 45 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(summary.avgEngagement, 100)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)]">{getEngagementQuality(summary.avgEngagement)}</p>
            </div>

            {/* Duration */}
            <div className="card p-4">
              <p className="text-xs text-[var(--muted-light)] font-medium mb-2">Duration</p>
              <p className="text-lg font-bold text-[var(--foreground)]">{summary.durationMinutes}</p>
              <p className="text-xs text-[var(--muted)]">minutes</p>
            </div>

            {/* Nudges */}
            <div className="card p-4">
              <p className="text-xs text-[var(--muted-light)] font-medium mb-2">Nudges</p>
              <p className="text-lg font-bold text-[var(--foreground)]">{summary.nudgesTriggered}</p>
              <p className="text-xs text-[var(--muted)]">coaching tips</p>
            </div>

            {/* Turns */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[var(--muted-light)] font-medium">Turns</p>
                <p className="text-lg font-bold text-[var(--foreground)]">{summary.turnCount ?? 0}</p>
              </div>
              <div className="h-1 bg-[var(--card-hover)] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${
                    (summary.turnCount ?? 0) >= 10 ? 'bg-green-500' :
                    (summary.turnCount ?? 0) >= 5 ? 'bg-blue-500' :
                    'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(((summary.turnCount ?? 0) / 20) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)]">{getTurnsQuality(summary.turnCount ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* ENGAGEMENT OVER TIME */}
        {startTime && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Engagement Over Time
            </h2>
            <div className="card p-5">
              <TimelineChart metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* FACIAL EXPRESSION ANALYSIS */}
        {metricsHistory.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Facial Expression Analysis
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <ExpressionRadarChart metricsHistory={metricsHistory} />
              <EmotionDistributionChart metricsHistory={metricsHistory} />
            </div>
          </div>
        )}

        {/* EXPRESSION TIMELINE */}
        {startTime && metricsHistory.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Expression Timeline
            </h2>
            <div className="card p-5">
              <ExpressionTimelineChart metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* DETAILED EXPRESSION BREAKDOWN */}
        {metricsHistory.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Detailed Expression Breakdown
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <FacialExpressionCard
                metricsHistory={metricsHistory}
                participant="student"
                participantName={sessionConfig.studentName}
              />
              <FacialExpressionCard
                metricsHistory={metricsHistory}
                participant="tutor"
                participantName={sessionConfig.tutorName}
              />
            </div>
          </div>
        )}

        {/* STUDENT STATE TIMELINE */}
        {startTime && metricsHistory.length > 10 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Student State Timeline
            </h2>
            <div className="card p-5">
              <StudentStateTimeline metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* COMMUNICATION & INTERACTION */}
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
            Communication &amp; Interaction
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Speaking Time */}
            <SpeakingTimeChart
              tutorPercent={summary.talkTimeRatio.tutor}
              studentPercent={summary.talkTimeRatio.student}
              tutorName={sessionConfig.tutorName}
              studentName={sessionConfig.studentName}
            />

            {/* Eye Contact */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">Eye Contact</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-[var(--muted)]">{sessionConfig.tutorName}</span>
                    <span className="text-sm font-bold text-[var(--foreground)]">{summary.avgTutorEye}%</span>
                  </div>
                  <div className="h-2 bg-[var(--card-hover)] rounded-full overflow-hidden">
                    <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${summary.avgTutorEye}%` }} />
                  </div>
                  <p className="text-xs text-[var(--muted-light)] mt-1">
                    {summary.avgTutorEye >= 70 ? 'Strong focus' : summary.avgTutorEye >= 50 ? 'Moderate' : 'Low attention'}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-[var(--muted)]">{sessionConfig.studentName}</span>
                    <span className="text-sm font-bold text-[var(--foreground)]">{summary.avgStudentEye}%</span>
                  </div>
                  <div className="h-2 bg-[var(--card-hover)] rounded-full overflow-hidden">
                    <div className="h-2 bg-purple-500 rounded-full" style={{ width: `${summary.avgStudentEye}%` }} />
                  </div>
                  <p className="text-xs text-[var(--muted-light)] mt-1">
                    {getEyeContactQuality(summary.avgStudentEye)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ENGAGEMENT HEATMAP */}
        {startTime && metricsHistory.length > 10 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Engagement Heatmap
            </h2>
            <div className="card p-5">
              <EngagementHeatmap metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* COACHING & NUDGES */}
        {(startTime && nudgeHistory.length > 0) || summary.keyMoments.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Coaching &amp; Nudges
            </h2>

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

            {/* Nudge history */}
            {nudgeHistory.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">Nudge History</h3>
                <div className="space-y-3">
                  {nudgeHistory.map((nudge) => (
                    <div key={nudge.id} className="flex items-start gap-3 text-sm border-l-2 border-[var(--card-border)] pl-3">
                      <span className="text-lg">{nudge.icon}</span>
                      <div className="flex-1">
                        <p className="text-[var(--foreground)]">{nudge.message}</p>
                        <p className="text-xs text-[var(--muted-light)] mt-1">
                          at {startTime ? formatMinuteTime(nudge.timestamp - startTime) : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* KEY MOMENTS */}
        {summary.keyMoments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
              Key Moments
            </h2>
            <div className="card p-5">
              <div className="space-y-3">
                {summary.keyMoments.map((moment, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm border-l-2 border-[var(--card-border)] pl-3">
                    <span className="text-lg mt-0.5">
                      {moment.type === 'drop' ? '📉' : '📈'}
                    </span>
                    <div className="flex-1">
                      <p className="text-[var(--foreground)]">{moment.description}</p>
                      <p className="text-xs text-[var(--muted-light)] mt-1">at {formatMinuteTime(moment.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RECOMMENDATIONS */}
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
            Recommendations
          </h2>
          <div className="card p-5">
            <ul className="space-y-3">
              {summary.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[var(--foreground)]">
                  <span className="text-base mt-0.5">💡</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Methodology note */}
        <div className="card p-4 mb-6 opacity-80">
          <p className="text-xs text-[var(--muted-light)] leading-relaxed">
            <span className="font-medium text-[var(--muted)]">How these metrics work:</span>{' '}
            Engagement scores are computed from eye contact (gaze estimation via MediaPipe), speaking time balance,
            audio energy, interruption frequency, and attention stability. These are calibrated heuristics, not
            validated psychometric instruments. Student states (confused, drifting, etc.) are inferred from
            facial expression + gaze + silence patterns. See the{' '}
            <a href="/docs/methodology" className="text-[var(--info)] hover:underline">analysis methodology</a>{' '}
            for full details and known limitations.
          </p>
        </div>

        {/* AI Analysis */}
        <AIAnalysis sessionId={sessionIdParam} />
      </div>
    </div>
  );
}
