'use client';

import { Suspense, useEffect, useState, useMemo, use } from 'react';
import { listSessions, StoredSession } from '@/lib/persistence/SessionStorage';
import { SessionSummarizer, SessionSummary } from '@/lib/reports/SessionSummarizer';
import { StudentState } from '@/lib/metrics-engine/types';

interface SessionData {
  session: StoredSession;
  summary: SessionSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function engagementColor(score: number): string {
  if (score >= 70) return 'var(--color-success, #22c55e)';
  if (score >= 50) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-danger, #ef4444)';
}

function engagementBg(score: number): string {
  if (score >= 70) return 'rgba(34,197,94,0.12)';
  if (score >= 50) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function dominantState(breakdown: Record<StudentState, number>): string {
  let best: StudentState = 'engaged';
  let max = 0;
  for (const [state, pct] of Object.entries(breakdown) as [StudentState, number][]) {
    if (pct > max) {
      max = pct;
      best = state;
    }
  }
  return best.charAt(0).toUpperCase() + best.slice(1);
}

function stateLabel(state: string): string {
  const labels: Record<string, string> = {
    Engaged: 'Focused and attentive',
    Passive: 'Listening quietly',
    Confused: 'May need clarification',
    Drifting: 'Attention wandering',
    Struggling: 'Finding it difficult',
  };
  return labels[state] || state;
}

// ---------------------------------------------------------------------------
// SVG Line Chart
// ---------------------------------------------------------------------------

function EngagementChart({ sessions }: { sessions: SessionData[] }) {
  if (sessions.length < 2) {
    return (
      <div style={styles.chartPlaceholder}>
        <p style={{ margin: 0, color: 'var(--text-secondary, #6b7280)' }}>
          More sessions needed to show trends. Complete at least 2 sessions to see an engagement chart.
        </p>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => a.session.startTime - b.session.startTime);
  const padding = { top: 20, right: 20, bottom: 50, left: 50 };
  const width = 600;
  const height = 260;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = sorted.map((s, i) => ({
    x: padding.left + (i / (sorted.length - 1)) * chartW,
    y: padding.top + chartH - (s.summary.overallEngagement / 100) * chartH,
    score: s.summary.overallEngagement,
    date: formatShortDate(s.session.startTime),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const refY = padding.top + chartH - (60 / 100) * chartH;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', maxWidth: width, height: 'auto' }}
        aria-label="Engagement trend chart"
      >
        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padding.top + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
                {v}%
              </text>
            </g>
          );
        })}

        {/* 60% reference line */}
        <line
          x1={padding.left}
          y1={refY}
          x2={padding.left + chartW}
          y2={refY}
          stroke="#f59e0b"
          strokeWidth={1}
          strokeDasharray="6 3"
        />
        <text
          x={padding.left + chartW + 2}
          y={refY + 4}
          fontSize={10}
          fill="#f59e0b"
        >
          Target
        </text>

        {/* Data line */}
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />

        {/* Area fill */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`}
          fill="rgba(99,102,241,0.08)"
        />

        {/* Data points + x-axis labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#6366f1" stroke="#fff" strokeWidth={2} />
            <text
              x={p.x}
              y={padding.top + chartH + 18}
              textAnchor="middle"
              fontSize={10}
              fill="#6b7280"
              transform={`rotate(-30, ${p.x}, ${padding.top + chartH + 18})`}
            >
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini talk-time bar
// ---------------------------------------------------------------------------

function TalkTimeBar({ tutor, student }: { tutor: number; student: number }) {
  const studentPct = Math.round(student * 100);
  const tutorPct = Math.round(tutor * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: '#6b7280', minWidth: 28 }}>{tutorPct}%</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#e5e7eb', display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: `${tutorPct}%`, background: '#93c5fd' }} />
        <div style={{ width: `${studentPct}%`, background: '#6366f1' }} />
      </div>
      <span style={{ color: '#6b7280', minWidth: 28 }}>{studentPct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content component
// ---------------------------------------------------------------------------

function ProgressContent({ studentName }: { studentName: string }) {
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const all = await listSessions();
        const filtered = all.filter(
          (s) => s.config.studentName.toLowerCase() === studentName.toLowerCase()
        );
        const summarizer = new SessionSummarizer();
        const data: SessionData[] = filtered.map((session) => ({
          session,
          summary: summarizer.summarize(session.metricsHistory, session.nudgeHistory, session.config),
        }));
        data.sort((a, b) => b.session.startTime - a.session.startTime);
        setSessionData(data);
      } catch {
        setSessionData([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentName]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (sessionData.length === 0) return null;

    const sorted = [...sessionData].sort((a, b) => a.session.startTime - b.session.startTime);
    const engagements = sorted.map((d) => d.summary.overallEngagement);
    const avgEngagement = engagements.reduce((a, b) => a + b, 0) / engagements.length;
    const totalTime = sorted.reduce((sum, d) => sum + d.summary.duration, 0);
    const first = sorted[0].session.startTime;
    const last = sorted[sorted.length - 1].session.startTime;

    // Most common subject
    const subjectCounts: Record<string, number> = {};
    sorted.forEach((d) => {
      const subj = d.session.config.subject || 'Unknown';
      subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
    });
    const topSubject = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Best session
    const best = sorted.reduce((prev, cur) =>
      cur.summary.overallEngagement > prev.summary.overallEngagement ? cur : prev
    );

    // Improvement: first 3 vs last 3
    const firstN = engagements.slice(0, Math.min(3, engagements.length));
    const lastN = engagements.slice(Math.max(0, engagements.length - 3));
    const firstAvg = firstN.reduce((a, b) => a + b, 0) / firstN.length;
    const lastAvg = lastN.reduce((a, b) => a + b, 0) / lastN.length;
    const improvement = lastAvg - firstAvg;

    // Overall trend
    let trend: 'improving' | 'stable' | 'needs_attention' = 'stable';
    if (engagements.length >= 3) {
      if (improvement > 5) trend = 'improving';
      else if (improvement < -5) trend = 'needs_attention';
    }

    // Average talk time
    const avgStudentTalk =
      sorted.reduce((sum, d) => sum + d.summary.talkTimeRatio.student, 0) / sorted.length;

    return {
      avgEngagement,
      totalTime,
      dateRange: { first, last },
      topSubject,
      bestSession: { engagement: best.summary.overallEngagement, date: best.session.startTime },
      improvement,
      trend,
      count: sessionData.length,
      avgStudentTalk,
    };
  }, [sessionData]);

  // Recommendations
  const recommendations = useMemo(() => {
    if (!stats || sessionData.length === 0) return [];
    const recs: string[] = [];

    if (stats.trend === 'needs_attention') {
      recs.push(
        'Consider reviewing session difficulty or trying a different approach to better match the student\'s needs.'
      );
    }
    if (stats.trend === 'improving') {
      recs.push(
        `Great progress! ${studentName} is showing consistent improvement across recent sessions.`
      );
    }
    if (stats.avgStudentTalk < 0.35) {
      recs.push(
        'Encouraging more student participation could deepen learning. Try open-ended questions and longer wait times.'
      );
    }
    if (stats.avgEngagement < 55) {
      recs.push(
        'Overall engagement has been on the lower side. Shorter, more interactive sessions may help maintain focus.'
      );
    }
    if (stats.avgEngagement >= 70 && stats.trend !== 'needs_attention') {
      recs.push(
        'Engagement is strong. Consider gradually increasing session complexity to continue challenging the student.'
      );
    }
    if (sessionData.length >= 5 && stats.improvement > 10) {
      recs.push(
        'Significant growth detected. This would be a great time to celebrate milestones and set new goals together.'
      );
    }
    if (sessionData.length < 3) {
      recs.push(
        'A few more sessions will provide deeper insights. Aim for at least 3-5 sessions for meaningful trend analysis.'
      );
    }

    return recs.slice(0, 3);
  }, [stats, sessionData, studentName]);

  // ---------- Loading ----------
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ color: 'var(--text-secondary, #6b7280)', marginTop: 16 }}>
          Loading progress data...
        </p>
      </div>
    );
  }

  // ---------- No sessions ----------
  if (sessionData.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary, #1f2937)' }}>
          No Sessions Found
        </h2>
        <p style={{ color: 'var(--text-secondary, #6b7280)', maxWidth: 400, textAlign: 'center' }}>
          We couldn&apos;t find any tutoring sessions for <strong>{studentName}</strong>. Sessions will appear here
          once they have been recorded.
        </p>
      </div>
    );
  }

  // ---------- Trend badge ----------
  const trendBadge = () => {
    if (!stats) return null;
    const config: Record<string, { label: string; bg: string; color: string }> = {
      improving: { label: 'Improving', bg: 'rgba(34,197,94,0.12)', color: '#16a34a' },
      stable: { label: 'Stable', bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
      needs_attention: { label: 'Needs Attention', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
    };
    const c = config[stats.trend];
    return (
      <span style={{ ...styles.badge, background: c.bg, color: c.color }}>{c.label}</span>
    );
  };

  return (
    <div style={styles.page}>
      {/* ===== Header ===== */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Progress Report: {studentName}</h1>
          <p style={styles.subtitle}>
            {stats!.count} session{stats!.count !== 1 ? 's' : ''}
            {stats!.count > 1 && (
              <>
                {' '}&middot;{' '}
                {formatDate(stats!.dateRange.first)} &ndash; {formatDate(stats!.dateRange.last)}
              </>
            )}
          </p>
        </div>
        {trendBadge()}
      </header>

      {/* ===== Engagement Trend Chart ===== */}
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Engagement Over Time</h2>
        <EngagementChart sessions={sessionData} />
      </section>

      {/* ===== Summary Statistics ===== */}
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Summary</h2>
        <div style={styles.statsGrid}>
          <StatTile label="Average Engagement" value={`${Math.round(stats!.avgEngagement)}%`} color={engagementColor(stats!.avgEngagement)} />
          <StatTile label="Total Tutoring Time" value={formatDuration(stats!.totalTime)} />
          <StatTile label="Sessions" value={String(stats!.count)} />
          <StatTile label="Top Subject" value={stats!.topSubject} />
          <StatTile
            label="Best Session"
            value={`${Math.round(stats!.bestSession.engagement)}%`}
            detail={formatDate(stats!.bestSession.date)}
            color={engagementColor(stats!.bestSession.engagement)}
          />
          <StatTile
            label="Improvement"
            value={`${stats!.improvement >= 0 ? '+' : ''}${Math.round(stats!.improvement)}%`}
            detail="First 3 vs last 3 sessions"
            color={stats!.improvement >= 0 ? '#16a34a' : '#dc2626'}
          />
        </div>
      </section>

      {/* ===== Session-by-Session Cards ===== */}
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Session History</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessionData.map((d) => {
            const state = dominantState(d.summary.studentStateBreakdown);
            return (
              <a
                key={d.session.id}
                href={`/analytics/${d.session.id}`}
                style={styles.sessionCard}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>
                      {formatDate(d.session.startTime)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary, #6b7280)', marginTop: 2 }}>
                      {d.session.config.subject || 'General'} &middot; {formatDuration(d.summary.duration)}
                    </div>
                  </div>
                  <span
                    style={{
                      ...styles.badge,
                      background: engagementBg(d.summary.overallEngagement),
                      color: engagementColor(d.summary.overallEngagement),
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {Math.round(d.summary.overallEngagement)}%
                  </span>
                </div>

                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
                    {state} &mdash; {stateLabel(state)}
                  </span>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Talk Time (Tutor / Student)</div>
                  <TalkTimeBar tutor={d.summary.talkTimeRatio.tutor} student={d.summary.talkTimeRatio.student} />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ===== Recommendations ===== */}
      {recommendations.length > 0 && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Recommendations</h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recommendations.map((rec, i) => (
              <li key={i} style={{ color: 'var(--text-primary, #374151)', lineHeight: 1.6, fontSize: 14 }}>
                {rec}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== Copy Link ===== */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
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

      {/* ===== Footer ===== */}
      <footer style={styles.footer}>
        <p style={{ margin: 0 }}>Powered by Session Analysis</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
          All session data is stored locally on this device. No personal information is shared externally.
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile component
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail?: string;
  color?: string;
}) {
  return (
    <div style={styles.statTile}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary, #1f2937)' }}>{value}</div>
      {detail && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{detail}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component (with Suspense)
// ---------------------------------------------------------------------------

export default function StudentProgressPage({
  params,
}: {
  params: Promise<{ studentName: string }>;
}) {
  const resolvedParams = use(params);
  const studentName = decodeURIComponent(resolvedParams.studentName);

  return (
    <Suspense
      fallback={
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={{ color: 'var(--text-secondary, #6b7280)', marginTop: 16 }}>
            Loading progress data...
          </p>
        </div>
      }
    >
      <ProgressContent studentName={studentName} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '24px 16px 48px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-primary, #1f2937)',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary, #6b7280)',
    margin: '4px 0 0',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  card: {
    background: 'var(--card-bg, #ffffff)',
    border: '1px solid var(--border-color, #e5e7eb)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary, #1f2937)',
    margin: '0 0 16px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  statTile: {
    background: 'var(--surface-bg, #f9fafb)',
    borderRadius: 8,
    padding: '14px 16px',
  },
  sessionCard: {
    display: 'block',
    background: 'var(--surface-bg, #f9fafb)',
    borderRadius: 10,
    padding: '14px 16px',
    textDecoration: 'none',
    border: '1px solid var(--border-color, #e5e7eb)',
    transition: 'box-shadow 0.15s',
    cursor: 'pointer',
  },
  chartPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    background: 'var(--surface-bg, #f9fafb)',
    borderRadius: 8,
    padding: 24,
    textAlign: 'center' as const,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: 24,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #e5e7eb',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '24px 0 0',
    fontSize: 13,
    color: 'var(--text-secondary, #6b7280)',
    borderTop: '1px solid var(--border-color, #e5e7eb)',
    marginTop: 8,
  },
};
