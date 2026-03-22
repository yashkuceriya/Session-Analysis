'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSessionStore } from '@/stores/sessionStore';
import { useMemo, useEffect, useState, lazy, Suspense } from 'react';
import { loadSession, StoredSession } from '@/lib/persistence/SessionStorage';
import { MetricSnapshot } from '@/lib/metrics-engine/types';
import { Nudge } from '@/lib/coaching-system/types';
import { SessionConfig } from '@/lib/session/types';

// Lazy load heavy chart components for faster initial page load
const TimelineChart = lazy(() => import('@/components/analytics/TimelineChart').then(m => ({ default: m.TimelineChart })));
const SpeakingTimeChart = lazy(() => import('@/components/analytics/SpeakingTimeChart').then(m => ({ default: m.SpeakingTimeChart })));
const EngagementHeatmap = lazy(() => import('@/components/analytics/EngagementHeatmap').then(m => ({ default: m.EngagementHeatmap })));
const AIAnalysis = lazy(() => import('@/components/analytics/AIAnalysis').then(m => ({ default: m.AIAnalysis })));
const NudgeEffectivenessChart = lazy(() => import('@/components/analytics/NudgeEffectivenessChart').then(m => ({ default: m.NudgeEffectivenessChart })));
const StudentStateTimeline = lazy(() => import('@/components/analytics/StudentStateTimeline').then(m => ({ default: m.StudentStateTimeline })));
const SessionNarrativeSummary = lazy(() => import('@/components/analytics/SessionNarrativeSummary').then(m => ({ default: m.SessionNarrativeSummary })));
const ExpressionRadarChart = lazy(() => import('@/components/analytics/ExpressionRadarChart').then(m => ({ default: m.ExpressionRadarChart })));
const EmotionDistributionChart = lazy(() => import('@/components/analytics/EmotionDistributionChart').then(m => ({ default: m.EmotionDistributionChart })));
const ExpressionTimelineChart = lazy(() => import('@/components/analytics/ExpressionTimelineChart').then(m => ({ default: m.ExpressionTimelineChart })));
const FacialExpressionCard = lazy(() => import('@/components/analytics/FacialExpressionCard').then(m => ({ default: m.FacialExpressionCard })));
const SessionTranscript = lazy(() => import('@/components/analytics/SessionTranscript').then(m => ({ default: m.SessionTranscript })));

function ChartLoader() {
  return <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[var(--card-border)] border-t-[var(--accent)] rounded-full animate-spin" /></div>;
}

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
  const storeTranscript = useSessionStore((s) => s.transcriptSegments);

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
            transcriptSegments: data.transcript || [],
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

  const transcriptSegments = useMemo(() =>
    hasInMemoryData ? storeTranscript : dbSession?.transcriptSegments ?? [],
    [hasInMemoryData, storeTranscript, dbSession]
  );

  const summary = useMemo(() => {
    if (metricsHistory.length === 0) return null;

    const avgEngagement = metricsHistory.reduce((sum, m) => sum + m.engagementScore, 0) / metricsHistory.length;
    const avgTutorEye = metricsHistory.reduce((sum, m) => sum + m.tutor.eyeContactScore, 0) / metricsHistory.length;
    const avgStudentEye = metricsHistory.reduce((sum, m) => sum + m.student.eyeContactScore, 0) / metricsHistory.length;
    const lastMetrics = metricsHistory[metricsHistory.length - 1];
    const durationMs = lastMetrics.session.elapsedMs;

    // Distraction & Focus metrics
    const avgDistraction = metricsHistory.reduce((sum, m) => sum + (m.student.distractionScore ?? 0), 0) / metricsHistory.length;
    const maxFocusStreak = lastMetrics.session.focusStreakMs ?? 0;
    const distractionEvents = lastMetrics.session.distractionEvents ?? 0;
    const avgHeadMovement = metricsHistory.reduce((sum, m) => sum + (m.student.headMovement ?? 0), 0) / metricsHistory.length;
    const avgBlinkRate = metricsHistory.length > 0
      ? metricsHistory[metricsHistory.length - 1].student.blinkRate ?? 0
      : 0;

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

    // Distraction-based recommendations
    if ((avgDistraction ?? 0) > 0.5) {
      recommendations.push('High distraction levels detected — try shorter segments with interactive checkpoints');
    }
    if ((avgHeadMovement ?? 0) > 0.5) {
      recommendations.push('Elevated head movement suggests restlessness — incorporate more hands-on activities');
    }
    if ((maxFocusStreak ?? 0) < 300000 && metricsHistory.length > 60) {
      recommendations.push('Focus streaks were short — try the Pomodoro technique with 5-minute focused segments');
    }

    if (recommendations.length === 0) {
      recommendations.push('Great session! Engagement levels were consistently strong');
    }

    return {
      avgEngagement: Math.round(avgEngagement),
      avgTutorEye: Math.round(avgTutorEye * 100),
      avgStudentEye: Math.round(avgStudentEye * 100),
      avgDistraction: avgDistraction,
      maxFocusStreak: maxFocusStreak,
      distractionEvents: distractionEvents,
      avgHeadMovement: avgHeadMovement,
      avgBlinkRate: avgBlinkRate,
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
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-[var(--foreground)]">Nerdy</span>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--card-border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted)] mt-4">Loading session analytics...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-[var(--foreground)]">Nerdy</span>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <svg className="w-16 h-16 text-[var(--muted-light)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">No data found for this session</h2>
          <p className="text-[var(--muted)] text-sm text-center max-w-md mb-6">The session may not have been saved, or the data has expired.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-all"
            >
              Start New Session
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-[var(--card-border)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-lg text-sm font-medium transition-all"
            >
              View Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header Navigation */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-lg text-[var(--foreground)]">Nerdy</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Dashboard</Link>
          <Link href="/" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Home</Link>
        </nav>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-light)] mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="hover:text-[var(--foreground)] transition-colors font-medium"
            >
              Dashboard
            </button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[var(--muted)]">Session Report</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">{sessionConfig.subject}</h1>
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-700"></span>
                  {sessionConfig.sessionType}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {summary.durationMinutes} min
                </span>
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
                  dataSource === 'server' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                  dataSource === 'memory' ? 'bg-[var(--info-light)] text-[var(--info)]' :
                  dataSource === 'local' ? 'bg-[var(--warning-light)] text-[var(--warning)]' :
                  'bg-[var(--card-hover)] text-[var(--muted)]'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {dataSource === 'server' ? 'Synced' :
                   dataSource === 'memory' ? 'Live' :
                   dataSource === 'local' ? 'Local' :
                   'Unknown'}
                </span>
              </div>
              <p className="text-[var(--muted-light)] text-xs mt-3 font-mono">{sessionIdParam}</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/highlights/${sessionIdParam}`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--card-border)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-lg text-sm font-medium transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share with Parent
              </Link>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>
            </div>
          </div>
        </div>

        {/* SESSION NARRATIVE SUMMARY */}
        <Suspense fallback={<ChartLoader />}>
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

        {/* SCORE RING & QUICK STATS */}
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium mb-4 pb-3 border-b border-[var(--card-border)]">
            Performance Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Engagement Score Ring - Featured */}
            <div className="card p-6 md:col-span-2 bg-gradient-to-br from-blue-50 to-transparent flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-4">Engagement Score</p>
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="var(--card-border)" strokeWidth="8" />
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke={
                      summary.avgEngagement >= 75 ? '#16a34a' :
                      summary.avgEngagement >= 60 ? '#3b82f6' :
                      summary.avgEngagement >= 45 ? '#f59e0b' :
                      '#ef4444'
                    }
                    strokeWidth="8"
                    strokeDasharray={`${(summary.avgEngagement / 100) * 339} 339`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-[var(--foreground)]">{summary.avgEngagement}</p>
                    <p className="text-xs text-[var(--muted-light)] mt-1">%</p>
                  </div>
                </div>
              </div>
              <p className={`text-sm font-semibold ${
                summary.avgEngagement >= 75 ? 'text-green-600' :
                summary.avgEngagement >= 60 ? 'text-blue-600' :
                summary.avgEngagement >= 45 ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {getEngagementQuality(summary.avgEngagement)}
              </p>
            </div>

            {/* Other Stats */}
            <div className="card p-4 bg-gradient-to-br from-purple-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-3">Duration</p>
              <p className="text-3xl font-bold text-[var(--foreground)]">{summary.durationMinutes}</p>
              <p className="text-xs text-[var(--muted-light)] mt-2">minutes</p>
            </div>

            <div className="card p-4 bg-gradient-to-br from-green-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-3">Exchanges</p>
              <p className="text-3xl font-bold text-[var(--foreground)]">{summary.turnCount ?? 0}</p>
              <p className="text-xs text-[var(--muted-light)] mt-2">{getTurnsQuality(summary.turnCount ?? 0)}</p>
            </div>

            <div className="card p-4 bg-gradient-to-br from-amber-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-3">Nudges</p>
              <p className="text-3xl font-bold text-[var(--foreground)]">{summary.nudgesTriggered}</p>
              <p className="text-xs text-[var(--muted-light)] mt-2">coaching tips</p>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="card p-4 bg-gradient-to-br from-violet-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Focus</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{Math.round((1 - (summary.avgDistraction ?? 0)) * 100)}%</p>
              <p className="text-xs text-[var(--muted-light)] mt-1">average</p>
            </div>
            <div className="card p-4 bg-gradient-to-br from-teal-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Interruptions</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{summary.interruptions}</p>
              <p className="text-xs text-[var(--muted-light)] mt-1">detected</p>
            </div>
            <div className="card p-4 bg-gradient-to-br from-rose-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Talk Ratio</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{summary.talkTimeRatio.tutor}:{summary.talkTimeRatio.student}</p>
              <p className="text-xs text-[var(--muted-light)] mt-1">tutor:student</p>
            </div>
            <div className="card p-4 bg-gradient-to-br from-cyan-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Eye Contact</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{summary.avgStudentEye}%</p>
              <p className="text-xs text-[var(--muted-light)] mt-1">{getEyeContactQuality(summary.avgStudentEye)}</p>
            </div>
          </div>
        </div>

        {/* ENGAGEMENT OVER TIME */}
        {startTime && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-[var(--info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Engagement Over Time
              </h2>
            </div>
            <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
              <TimelineChart metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* FACIAL EXPRESSION ANALYSIS */}
        {metricsHistory.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Facial Expression Analysis
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <ExpressionRadarChart metricsHistory={metricsHistory} />
              <EmotionDistributionChart metricsHistory={metricsHistory} />
            </div>
          </div>
        )}

        {/* EXPRESSION TIMELINE */}
        {startTime && metricsHistory.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Expression Timeline
              </h2>
            </div>
            <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
              <ExpressionTimelineChart metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* DETAILED EXPRESSION BREAKDOWN */}
        {metricsHistory.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Detailed Expression Breakdown
              </h2>
            </div>
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
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Student State Timeline
              </h2>
            </div>
            <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
              <StudentStateTimeline metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* DISTRACTION & FOCUS ANALYSIS */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
            <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
              Focus & Distraction Analysis
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-5 bg-gradient-to-br from-violet-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Focus Score</p>
              <p className="text-3xl font-bold text-[var(--foreground)]">{Math.round((1 - (summary.avgDistraction ?? 0)) * 100)}%</p>
              <p className="text-xs text-[var(--muted-light)] mt-2">
                {(summary.avgDistraction ?? 0) < 0.3 ? 'Excellent focus' : (summary.avgDistraction ?? 0) < 0.5 ? 'Good focus' : 'Needs improvement'}
              </p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-emerald-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Longest Focus Streak</p>
              <p className="text-3xl font-bold text-[var(--foreground)]">{Math.round((summary.maxFocusStreak ?? 0) / 60000)}m</p>
              <p className="text-xs text-[var(--muted-light)] mt-2">continuous focus</p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-amber-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Distraction Events</p>
              <p className="text-3xl font-bold text-[var(--foreground)]">{summary.distractionEvents ?? 0}</p>
              <p className="text-xs text-[var(--muted-light)] mt-2">attention breaks</p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-blue-50 to-transparent">
              <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-2">Blink Rate</p>
              <p className="text-3xl font-bold text-[var(--foreground)]">{Math.round(summary.avgBlinkRate ?? 0)}</p>
              <p className="text-xs text-[var(--muted-light)] mt-2">blinks/min {(summary.avgBlinkRate ?? 0) > 25 ? '(elevated)' : '(normal)'}</p>
            </div>
          </div>
        </div>

        {/* MOVEMENT & POSTURE */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
            <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
              Movement & Body Language
            </h2>
          </div>
          <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-3">Head Movement</p>
                <div className="flex items-end gap-2 mb-2">
                  <p className="text-2xl font-bold text-[var(--foreground)]">{Math.round((summary.avgHeadMovement ?? 0) * 100)}%</p>
                  <p className="text-xs text-[var(--muted-light)] mb-1">activity</p>
                </div>
                <div className="h-2 bg-[var(--card-hover)] rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      (summary.avgHeadMovement ?? 0) > 0.6 ? 'bg-red-400' :
                      (summary.avgHeadMovement ?? 0) > 0.3 ? 'bg-amber-400' :
                      'bg-green-400'
                    }`}
                    style={{ width: `${Math.round((summary.avgHeadMovement ?? 0) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--muted-light)] mt-2">
                  {(summary.avgHeadMovement ?? 0) > 0.6 ? 'High movement — possible restlessness' :
                   (summary.avgHeadMovement ?? 0) > 0.3 ? 'Normal movement' :
                   'Low movement — steady and focused'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-light)] font-medium uppercase tracking-wider mb-3">Engagement Signals</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted)]">Head nods detected</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {metricsHistory.filter(m => (m.studentExpression?.headNod ?? 0) > 0.3).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted)]">Smiles detected</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {metricsHistory.filter(m => (m.studentExpression?.smile ?? 0) > 0.4).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted)]">Confusion moments</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {metricsHistory.filter(m => (m.studentExpression?.confusion ?? 0) > 0.4).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COMMUNICATION & INTERACTION */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
            <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
              Communication &amp; Interaction
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Speaking Time */}
            <SpeakingTimeChart
              tutorPercent={summary.talkTimeRatio.tutor}
              studentPercent={summary.talkTimeRatio.student}
              tutorName={sessionConfig.tutorName}
              studentName={sessionConfig.studentName}
            />

            {/* Eye Contact */}
            <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Eye Contact
              </h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-[var(--muted)]">{sessionConfig.tutorName}</span>
                    <span className="text-lg font-bold text-[var(--foreground)]">{summary.avgTutorEye}%</span>
                  </div>
                  <div className="h-3 bg-[var(--card-hover)] rounded-full overflow-hidden">
                    <div className="h-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${summary.avgTutorEye}%` }} />
                  </div>
                  <p className={`text-xs font-medium mt-2 ${
                    summary.avgTutorEye >= 70 ? 'text-green-600' :
                    summary.avgTutorEye >= 50 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {summary.avgTutorEye >= 70 ? '✓ Strong focus' : summary.avgTutorEye >= 50 ? '~ Moderate' : '✗ Low attention'}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-[var(--muted)]">{sessionConfig.studentName}</span>
                    <span className="text-lg font-bold text-[var(--foreground)]">{summary.avgStudentEye}%</span>
                  </div>
                  <div className="h-3 bg-[var(--card-hover)] rounded-full overflow-hidden">
                    <div className="h-3 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" style={{ width: `${summary.avgStudentEye}%` }} />
                  </div>
                  <p className={`text-xs font-medium mt-2 ${
                    summary.avgStudentEye >= 70 ? 'text-green-600' :
                    summary.avgStudentEye >= 50 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {summary.avgStudentEye >= 70 ? '✓ Strong focus' : summary.avgStudentEye >= 50 ? '~ Moderate' : '✗ Low attention'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ENGAGEMENT HEATMAP */}
        {startTime && metricsHistory.length > 10 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Engagement Heatmap
              </h2>
            </div>
            <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
              <EngagementHeatmap metricsHistory={metricsHistory} startTime={startTime} />
            </div>
          </div>
        )}

        {/* COACHING & NUDGES */}
        {(startTime && nudgeHistory.length > 0) || summary.keyMoments.length > 0 ? (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Coaching &amp; Nudges
              </h2>
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

            {/* Nudge history */}
            {nudgeHistory.length > 0 && (
              <div className="card p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-orange-50 to-transparent">
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Nudges Triggered
                </h3>
                <div className="space-y-2">
                  {nudgeHistory.map((nudge) => (
                    <div key={nudge.id} className="flex items-start gap-3 text-sm bg-white rounded-lg p-3 border-l-2 border-orange-300">
                      <span className="text-xl shrink-0 mt-0.5">{nudge.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--foreground)] font-medium">{nudge.message}</p>
                        <p className="text-xs text-[var(--muted-light)] mt-1 font-mono">
                          {startTime ? formatMinuteTime(nudge.timestamp - startTime) : ''}
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
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Key Moments
              </h2>
            </div>
            <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
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
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
            <svg className="w-4 h-4 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
              Recommendations
            </h2>
          </div>
          <div className="card p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-yellow-50 to-transparent">
            <ul className="space-y-3">
              {summary.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[var(--foreground)] p-3 bg-white rounded-lg border-l-2 border-[var(--accent)]">
                  <span className="text-lg mt-0.5 shrink-0">💡</span>
                  <span className="pt-0.5">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* SESSION TRANSCRIPT */}
        {transcriptSegments.length > 0 && startTime && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--card-border)]">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-xs uppercase tracking-wider text-[var(--muted-light)] font-medium">
                Session Transcript
              </h2>
            </div>
            <SessionTranscript
              segments={transcriptSegments}
              sessionStartTime={startTime}
              tutorName={sessionConfig.tutorName}
              studentName={sessionConfig.studentName}
            />
          </div>
        )}

        {/* Methodology note */}
        <div className="card p-4 mb-6 bg-blue-50 border border-blue-100">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-medium text-blue-900 mb-1">How these metrics work</p>
              <p className="text-xs text-blue-800 leading-relaxed">
                Engagement scores are computed from eye contact (gaze estimation via MediaPipe), speaking time balance,
                audio energy, interruption frequency, and attention stability. These are calibrated heuristics, not
                validated psychometric instruments. Student states (confused, drifting, etc.) are inferred from
                facial expression + gaze + silence patterns. See the{' '}
                <a href="/docs/methodology" className="font-medium underline hover:no-underline">analysis methodology</a>{' '}
                for full details and known limitations.
              </p>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <AIAnalysis
          sessionId={sessionIdParam}
          metricsHistory={metricsHistory}
          nudgeHistory={nudgeHistory}
          sessionConfig={sessionConfig}
        />
        </Suspense>
      </div>
    </div>
  );
}
