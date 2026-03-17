'use client';

import { useEffect, useState, use } from 'react';
import { loadSession, StoredSession } from '@/lib/persistence/SessionStorage';
import { SessionSummarizer, KeyMoment, SessionSummary } from '@/lib/reports/SessionSummarizer';
import { RecommendationEngine, Recommendation } from '@/lib/reports/RecommendationEngine';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `at ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function engagementColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function engagementLabel(score: number): string {
  if (score >= 70) return 'Excellent';
  if (score >= 50) return 'Good';
  return 'Needs Attention';
}

function momentBadge(type: KeyMoment['type']): { label: string; bg: string; fg: string } {
  switch (type) {
    case 'peak':
      return { label: 'High Point', bg: '#dcfce7', fg: '#166534' };
    case 'valley':
      return { label: 'Low Point', bg: '#ffedd5', fg: '#9a3412' };
    case 'state_change':
      return { label: 'Shift', bg: '#dbeafe', fg: '#1e40af' };
    case 'nudge':
      return { label: 'Coaching Moment', bg: '#f3e8ff', fg: '#6b21a8' };
  }
}

function dominantState(breakdown: Record<string, number>): { state: string; pct: number } {
  let top = { state: 'engaged', pct: 0 };
  for (const [state, pct] of Object.entries(breakdown)) {
    if (pct > top.pct) top = { state, pct };
  }
  return top;
}

function friendlyState(state: string): string {
  const map: Record<string, string> = {
    engaged: 'Focused & Engaged',
    passive: 'Listening Quietly',
    confused: 'Working Through Confusion',
    drifting: 'Attention Wandering',
    struggling: 'Finding It Challenging',
  };
  return map[state] ?? state;
}

// ---------------------------------------------------------------------------
// Score Ring SVG
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = engagementColor(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--card, #f1f5f9)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: 'center',
            fontSize: size * 0.22,
            fontWeight: 700,
            fill: 'var(--foreground, #1e293b)',
          }}
        >
          {Math.round(score)}%
        </text>
      </svg>
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          color,
          letterSpacing: '0.02em',
        }}
      >
        {engagementLabel(score)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Talk‑time bar
// ---------------------------------------------------------------------------

function TalkTimeBar({ tutor, student }: { tutor: number; student: number }) {
  const tPct = Math.round(tutor * 100);
  const sPct = Math.round(student * 100);
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          marginBottom: 4,
          color: 'var(--foreground, #475569)',
        }}
      >
        <span>Tutor {tPct}%</span>
        <span>Student {sPct}%</span>
      </div>
      <div
        style={{
          display: 'flex',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
          background: 'var(--card, #f1f5f9)',
        }}
      >
        <div style={{ width: `${tPct}%`, background: '#6366f1', transition: 'width 0.6s ease' }} />
        <div style={{ width: `${sPct}%`, background: '#22c55e', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HighlightsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Try IndexedDB first, then fall back to API
        let data = await loadSession(sessionId);

        if (!data) {
          const res = await fetch(`/api/sessions/${sessionId}`);
          if (!res.ok) throw new Error('Session not found');
          data = await res.json();
        }

        if (cancelled || !data) {
          if (!data) throw new Error('Session not found');
          return;
        }

        setSession(data);

        const summarizer = new SessionSummarizer();
        const sum = summarizer.summarize(
          data.metricsHistory,
          data.nudgeHistory,
          data.config,
        );
        setSummary(sum);

        const engine = new RecommendationEngine();
        const recs = engine.generateRecommendations(sum, data.config);
        setRecommendations(recs.slice(0, 3));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ---- Loading state ----
  if (loading) {
    return (
      <div style={styles.center}>
        <style>{`@keyframes hl-spin { to { transform: rotate(360deg) } }`}</style>
        <div
          style={{
            width: 40,
            height: 40,
            border: '4px solid var(--card, #e2e8f0)',
            borderTopColor: 'var(--accent, #6366f1)',
            borderRadius: '50%',
            animation: 'hl-spin 0.8s linear infinite',
          }}
        />
        <p style={{ marginTop: 16, color: 'var(--foreground, #64748b)' }}>Loading session highlights...</p>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !session || !summary) {
    return (
      <div style={styles.center}>
        <h2 style={{ fontSize: 22, marginBottom: 8, color: 'var(--foreground, #1e293b)' }}>
          Session Not Found
        </h2>
        <p style={{ color: 'var(--foreground, #64748b)', marginBottom: 20 }}>
          {error ?? 'We could not locate this session.'}
        </p>
        <Link href="/" style={styles.backLink}>
          Back to Home
        </Link>
      </div>
    );
  }

  const { config, startTime } = session;
  const dominant = dominantState(summary.studentStateBreakdown);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* ── Header ──────────────────────────────────────────── */}
        <header style={styles.header}>
          <h1 style={styles.title}>Session Highlights</h1>
          <div style={styles.meta}>
            <span style={styles.subject}>{config.subject}</span>
            <span style={styles.dot}>·</span>
            <span>{formatDate(startTime)}</span>
          </div>
          <div style={styles.meta}>
            <span>{config.studentName} with {config.tutorName}</span>
            <span style={styles.dot}>·</span>
            <span>{formatDuration(summary.duration)}</span>
          </div>
        </header>

        {/* ── Engagement Score (hero) ─────────────────────────── */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Overall Engagement</h2>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <ScoreRing score={summary.overallEngagement} />
          </div>
        </section>

        {/* ── Moments of Learning ─────────────────────────────── */}
        {summary.keyMoments.length > 0 && (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Moments of Learning</h2>
            <div style={styles.momentsList}>
              {summary.keyMoments.map((m, i) => {
                const badge = momentBadge(m.type);
                return (
                  <div key={i} style={styles.momentCard}>
                    <div style={styles.momentTop}>
                      <span style={{ fontSize: 13, color: 'var(--foreground, #64748b)' }}>
                        {formatTimestamp(m.timestamp)}
                      </span>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: badge.bg,
                          color: badge.fg,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p style={styles.momentDesc}>{m.description}</p>
                    <span style={{ fontSize: 13, fontWeight: 600, color: engagementColor(m.engagementScore) }}>
                      Engagement: {Math.round(m.engagementScore)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Session Snapshot (grid) ─────────────────────────── */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Session Snapshot</h2>
          <div style={styles.grid}>
            {/* Duration */}
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Duration</span>
              <span style={styles.statValue}>{formatDuration(summary.duration)}</span>
            </div>

            {/* Talk Time */}
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Talk Time</span>
              <TalkTimeBar tutor={summary.talkTimeRatio.tutor} student={summary.talkTimeRatio.student} />
            </div>

            {/* Eye Contact */}
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Eye Contact</span>
              <div style={{ display: 'flex', gap: 16, fontSize: 14, color: 'var(--foreground, #334155)' }}>
                <span>Tutor {Math.round(summary.eyeContactAvg.tutor * 100)}%</span>
                <span>Student {Math.round(summary.eyeContactAvg.student * 100)}%</span>
              </div>
            </div>

            {/* Student State */}
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Student State</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground, #1e293b)' }}>
                {friendlyState(dominant.state)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground, #64748b)' }}>
                {Math.round(dominant.pct)}% of session
              </span>
            </div>
          </div>
        </section>

        {/* ── Key Takeaways ───────────────────────────────────── */}
        {recommendations.length > 0 && (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Key Takeaways</h2>
            <ul style={styles.takeawaysList}>
              {recommendations.map((rec, i) => (
                <li key={i} style={styles.takeaway}>
                  <span style={styles.takeawayDot}>&#9679;</span>
                  <span>{rec.suggestion}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Copy Link ────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--accent, #6366f1)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {linkCopied ? 'Link Copied!' : 'Copy Link'}
          </button>
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer style={styles.footer}>
          <p style={styles.footerBrand}>Powered by Nerdy Session Analysis</p>
          <Link href={`/analytics/${sessionId}`} style={styles.footerLink}>
            View full analytics
          </Link>
          <p style={styles.privacyNote}>
            All analysis was performed locally &mdash; no video data was stored or transmitted.
          </p>
        </footer>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--background, #f8fafc)',
    padding: '32px 16px 64px',
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
  },
  container: {
    maxWidth: 640,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
  },
  backLink: {
    color: 'var(--accent, #6366f1)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
  },

  /* Header */
  header: {
    textAlign: 'center' as const,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--foreground, #0f172a)',
    marginBottom: 6,
  },
  meta: {
    fontSize: 14,
    color: 'var(--foreground, #475569)',
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  subject: {
    fontWeight: 600,
    color: 'var(--accent, #6366f1)',
  },
  dot: {
    opacity: 0.4,
  },

  /* Cards */
  card: {
    background: 'var(--card, #ffffff)',
    borderRadius: 16,
    padding: '24px 24px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--foreground, #1e293b)',
    marginBottom: 14,
  },

  /* Moments */
  momentsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  momentCard: {
    background: 'var(--background, #f8fafc)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  momentTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 999,
    padding: '2px 10px',
  },
  momentDesc: {
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--foreground, #334155)',
    margin: 0,
  },

  /* Grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  statCard: {
    background: 'var(--background, #f8fafc)',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: 'var(--foreground, #94a3b8)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--foreground, #1e293b)',
  },

  /* Takeaways */
  takeawaysList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  takeaway: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    fontSize: 15,
    lineHeight: 1.55,
    color: 'var(--foreground, #334155)',
  },
  takeawayDot: {
    color: 'var(--accent, #6366f1)',
    fontSize: 8,
    marginTop: 7,
    flexShrink: 0,
  },

  /* Footer */
  footer: {
    textAlign: 'center' as const,
    paddingTop: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 8,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--foreground, #94a3b8)',
    margin: 0,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--accent, #6366f1)',
    textDecoration: 'none',
  },
  privacyNote: {
    fontSize: 12,
    color: 'var(--foreground, #94a3b8)',
    maxWidth: 360,
    lineHeight: 1.5,
    margin: 0,
  },
};
