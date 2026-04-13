'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { loadSession, StoredSession } from '@/lib/persistence/SessionStorage';
import { useSessionStore } from '@/stores/sessionStore';
import { SessionSummarizer } from '@/lib/reports/SessionSummarizer';

interface QuickStats {
  engagement: number;
  duration: string;
  talkTime: { tutor: number; student: number };
  eyeContact: { tutor: number; student: number };
  topState: string;
  topStatePercent: number;
  keyMomentCount: number;
  nudgeCount: number;
}

function SessionEndedInner() {
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'student';
  const sessionIdParam = searchParams.get('sessionId');

  const [stats, setStats] = useState<QuickStats | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        // Try to get session ID from param or store
        const storeState = useSessionStore.getState();
        const sid = sessionIdParam || storeState.sessionId;
        if (sid) setSessionId(sid);

        // Try to load session data from IndexedDB
        let session: StoredSession | null = null;
        if (sid) {
          session = await loadSession(sid);
        }

        if (session && session.metricsHistory.length > 0) {
          const summarizer = new SessionSummarizer();
          const summary = summarizer.summarize(
            session.metricsHistory,
            session.nudgeHistory || [],
            session.config
          );

          const durationMs = session.endTime
            ? session.endTime - session.startTime
            : Date.now() - session.startTime;
          const minutes = Math.floor(durationMs / 60000);
          const seconds = Math.floor((durationMs % 60000) / 1000);

          // Find dominant state
          const states = Object.entries(summary.studentStateBreakdown) as [string, number][];
          const topEntry = states.sort((a, b) => b[1] - a[1])[0];

          setStats({
            engagement: Math.round(summary.overallEngagement),
            duration: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`,
            talkTime: {
              tutor: Math.round(summary.talkTimeRatio.tutor * 100),
              student: Math.round(summary.talkTimeRatio.student * 100),
            },
            eyeContact: {
              tutor: Math.round(summary.eyeContactAvg.tutor * 100),
              student: Math.round(summary.eyeContactAvg.student * 100),
            },
            topState: topEntry[0],
            topStatePercent: Math.round(topEntry[1]),
            keyMomentCount: summary.keyMoments.length,
            nudgeCount: summary.nudgesSummary.total,
          });
        }
      } catch {
        // Stats are optional — page still works without them
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [sessionIdParam]);

  const getEngagementColor = (score: number) => {
    if (score >= 70) return { ring: 'text-green-500', bg: 'bg-green-50', label: 'Excellent' };
    if (score >= 50) return { ring: 'text-amber-500', bg: 'bg-amber-50', label: 'Good' };
    return { ring: 'text-red-500', bg: 'bg-red-50', label: 'Needs Improvement' };
  };

  const isTutor = role === 'tutor';

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-lg text-[var(--foreground)]">Session Analysis</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          {/* Success header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Session Complete!</h1>
            <p className="text-[var(--muted)] leading-relaxed">
              {isTutor
                ? 'Great session! Here\u2019s a quick snapshot of how it went.'
                : 'Nice work! Your tutor will review the session insights.'}
            </p>
          </div>

          {/* Quick stats */}
          {!loading && stats && (
            <div className="card p-6 mb-6 border border-[var(--card-border)]">
              {/* Engagement score hero */}
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--card-border)" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={stats.engagement >= 70 ? '#22c55e' : stats.engagement >= 50 ? '#eab308' : '#ef4444'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(stats.engagement / 100) * 264} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[var(--foreground)]">{stats.engagement}%</span>
                    <span className="text-[10px] text-[var(--muted)]">Engagement</span>
                  </div>
                </div>
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div className="text-center p-3 rounded-lg bg-[var(--card-hover)]">
                  <div className="text-lg font-bold text-[var(--foreground)]">{stats.duration}</div>
                  <div className="text-xs text-[var(--muted)]">Duration</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--card-hover)]">
                  <div className="text-lg font-bold capitalize text-[var(--foreground)]">{stats.topState}</div>
                  <div className="text-xs text-[var(--muted)]">{stats.topStatePercent}% of session</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--card-hover)]">
                  <div className="text-lg font-bold text-[var(--foreground)]">{stats.keyMomentCount}</div>
                  <div className="text-xs text-[var(--muted)]">Key Moments</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--card-hover)]">
                  <div className="text-lg font-bold text-[var(--foreground)]">{stats.nudgeCount}</div>
                  <div className="text-xs text-[var(--muted)]">Coaching Nudges</div>
                </div>
              </div>

              {/* Talk time bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[var(--muted)] mb-1.5">
                  <span>Talk Time</span>
                  <span>Tutor {stats.talkTime.tutor}% / Student {stats.talkTime.student}%</span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--card-border)]">
                  <div className="bg-[var(--accent)] rounded-l-full" style={{ width: `${stats.talkTime.tutor}%` }} />
                  <div className="bg-emerald-500 rounded-r-full" style={{ width: `${stats.talkTime.student}%` }} />
                </div>
              </div>

              {/* Eye contact bar */}
              <div>
                <div className="flex justify-between text-xs text-[var(--muted)] mb-1.5">
                  <span>Eye Contact</span>
                  <span>Tutor {stats.eyeContact.tutor}% / Student {stats.eyeContact.student}%</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="h-2.5 rounded-full bg-[var(--card-border)] overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${stats.eyeContact.tutor}%` }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="h-2.5 rounded-full bg-[var(--card-border)] overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${stats.eyeContact.student}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading state for stats */}
          {loading && (
            <div className="card p-8 mb-6 border border-[var(--card-border)] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[var(--card-border)] border-t-[var(--accent)] rounded-full animate-spin" />
              <span className="ml-3 text-sm text-[var(--muted)]">Loading session summary...</span>
            </div>
          )}

          {/* Share with Parent */}
          {isTutor && sessionId && !loading && stats && (
            <div className="card p-5 mb-6 border border-[var(--card-border)] bg-gradient-to-r from-purple-50/50 to-transparent">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--foreground)] text-sm mb-1">Share with parent/guardian</h3>
                  <p className="text-xs text-[var(--muted)] mb-3">
                    Send a parent-friendly summary — no login required to view.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/highlights/${sessionId}`}
                      className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                    >
                      Session Highlights
                    </Link>
                    <Link
                      href={`/progress/${encodeURIComponent(useSessionStore.getState().sessionConfig?.studentName || 'Student')}`}
                      className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                    >
                      Student Progress
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* What's next */}
          <div className="card p-5 mb-6 border border-[var(--card-border)] bg-gradient-to-r from-blue-50/50 to-transparent">
            <h3 className="font-semibold text-[var(--foreground)] text-sm mb-3">What&apos;s next?</h3>
            <ul className="space-y-2">
              {isTutor ? (
                <>
                  <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="text-blue-500 mt-0.5">1.</span>
                    <span>Review the full analytics with engagement timeline and expression data</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="text-blue-500 mt-0.5">2.</span>
                    <span>Check the AI-generated coaching feedback for personalized tips</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="text-blue-500 mt-0.5">3.</span>
                    <span>Export the session report (JSON/CSV) to share or archive</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="text-blue-500 mt-0.5">1.</span>
                    <span>Your tutor is reviewing the session analytics right now</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="text-blue-500 mt-0.5">2.</span>
                    <span>Review what you learned while it&apos;s fresh</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="text-blue-500 mt-0.5">3.</span>
                    <span>Come prepared with questions for your next session</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {isTutor && sessionId && (
              <Link
                href={`/analytics/${sessionId}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-[var(--accent)] to-orange-500 hover:from-[var(--accent-hover)] hover:to-orange-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-orange-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Full Analytics
              </Link>
            )}
            {isTutor && sessionId && (
              <Link
                href={`/reports/${sessionId}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--card)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-xl font-medium transition-colors border border-[var(--card-border)]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Session Report
              </Link>
            )}
            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="flex-1 py-3 text-center bg-[var(--card)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-xl font-medium transition-colors border border-[var(--card-border)]"
              >
                Dashboard
              </Link>
              <Link
                href="/"
                className="flex-1 py-3 text-center bg-[var(--card)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-xl font-medium transition-colors border border-[var(--card-border)]"
              >
                New Session
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SessionEndedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--card-border)] border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      }
    >
      <SessionEndedInner />
    </Suspense>
  );
}
