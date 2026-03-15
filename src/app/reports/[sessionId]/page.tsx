/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadSession } from '@/lib/persistence/SessionStorage';
import { SessionSummarizer } from '@/lib/reports/SessionSummarizer';
import { ReportGenerator } from '@/lib/reports/ReportGenerator';
import { RecommendationEngine } from '@/lib/reports/RecommendationEngine';
import { SessionReport } from '@/lib/reports/ReportGenerator';
import styles from './page.module.css';

interface PageProps {
  params: {
    sessionId: string;
  };
}

export default function ReportPage({ params }: PageProps) {
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      try {
        const session = await loadSession(params.sessionId);

        if (!session) {
          setError('Session not found');
          setLoading(false);
          return;
        }

        // Generate summary
        const summarizer = new SessionSummarizer();
        const summary = summarizer.summarize(
          session.metricsHistory,
          session.nudgeHistory,
          session.config
        );

        // Generate report
        const generator = new ReportGenerator();
        const generatedReport = generator.generateReport(
          summary,
          session.metricsHistory,
          session.id,
          session.config.subject,
          session.config.sessionType,
          session.config.studentName,
          session.config.tutorName
        );

        setReport(generatedReport);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [params.sessionId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p>Loading session report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
          <h2>Session Not Found</h2>
          <p>{error || 'Unable to load the requested session.'}</p>
          <Link href="/dashboard" className={styles.backLink}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const recommendations = new RecommendationEngine().generateRecommendations(
    report.summary,
    {
      subject: report.metadata.subject,
      sessionType: report.metadata.sessionType as any,
      studentLevel: 'intermediate',
      tutorName: report.metadata.tutorName,
      studentName: report.metadata.studentName,
    }
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const handleDownloadJSON = () => {
    const generator = new ReportGenerator();
    generator.downloadJSON(report, `report-${report.metadata.sessionId}.json`);
  };

  const handleDownloadCSV = () => {
    const generator = new ReportGenerator();
    generator.downloadCSV(report.timeline as any[], `metrics-${report.metadata.sessionId}.csv`);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/dashboard" className={styles.backLink}>
            ← Back to Dashboard
          </Link>
          <h1>{report.metadata.subject} Session Report</h1>
          <div className={styles.headerMeta}>
            <span>{report.metadata.sessionType}</span>
            <span>{formatDate(report.metadata.date)}</span>
          </div>
        </div>
      </header>

      <main className={styles.content}>
        {/* Score Card */}
        <section className={styles.scoreCard}>
          <div className={styles.scoreContent}>
            <div className={styles.scoreMain}>
              <div className={styles.scoreValue}>{Math.round(report.summary.overallEngagement)}%</div>
              <div className={styles.scoreLabel}>Overall Engagement</div>
            </div>
            <div className={styles.scoreDetails}>
              <div className={styles.scoreDetail}>
                <span className={styles.detailLabel}>Duration</span>
                <span className={styles.detailValue}>{formatDuration(report.metadata.duration)}</span>
              </div>
              <div className={styles.scoreDetail}>
                <span className={styles.detailLabel}>Trend</span>
                <span
                  className={`${styles.detailValue} ${styles[`trend${report.summary.engagementTrend}`]}`}
                >
                  {report.summary.engagementTrend}
                </span>
              </div>
              <div className={styles.scoreDetail}>
                <span className={styles.detailLabel}>Student</span>
                <span className={styles.detailValue}>{report.metadata.studentName}</span>
              </div>
              <div className={styles.scoreDetail}>
                <span className={styles.detailLabel}>Tutor</span>
                <span className={styles.detailValue}>{report.metadata.tutorName}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Engagement Timeline */}
        <section className={styles.section}>
          <h2>Engagement Over Time</h2>
          <div className={styles.timelineChart}>
            <EngagementTimeline timeline={report.summary.keyMoments} />
          </div>
        </section>

        {/* Two Column Grid */}
        <div className={styles.grid}>
          {/* Student State Breakdown */}
          <section className={styles.section}>
            <h2>Student State Breakdown</h2>
            <div className={styles.stateBreakdown}>
              {Object.entries(report.summary.studentStateBreakdown).map(([state, percent]) => (
                <div key={state} className={styles.stateItem}>
                  <div className={styles.stateLabel}>{capitalizeFirst(state)}</div>
                  <div className={styles.stateBar}>
                    <div
                      className={`${styles.stateFill} ${styles[`state${capitalizeFirst(state)}`]}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className={styles.statePercent}>{Math.round(percent)}%</div>
                </div>
              ))}
            </div>
          </section>

          {/* Talk Time Distribution */}
          <section className={styles.section}>
            <h2>Talk Time Distribution</h2>
            <div className={styles.talkTime}>
              <TalkTimeChart ratio={report.summary.talkTimeRatio} />
            </div>
          </section>
        </div>

        {/* Eye Contact */}
        <div className={styles.grid}>
          <section className={styles.section}>
            <h2>Eye Contact</h2>
            <div className={styles.eyeContact}>
              <div className={styles.eyeContactItem}>
                <span className={styles.label}>Tutor</span>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreFill}
                    style={{ width: `${report.summary.eyeContactAvg.tutor * 100}%` }}
                  />
                </div>
                <span className={styles.value}>{Math.round(report.summary.eyeContactAvg.tutor * 100)}%</span>
              </div>
              <div className={styles.eyeContactItem}>
                <span className={styles.label}>Student</span>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreFill}
                    style={{ width: `${report.summary.eyeContactAvg.student * 100}%` }}
                  />
                </div>
                <span className={styles.value}>{Math.round(report.summary.eyeContactAvg.student * 100)}%</span>
              </div>
            </div>
          </section>

          {/* Nudges Summary */}
          <section className={styles.section}>
            <h2>Coaching Nudges</h2>
            <div className={styles.nudgesSummary}>
              <div className={styles.nudgeItem}>
                <span className={styles.label}>Total Nudges</span>
                <span className={styles.value}>{report.summary.nudgesSummary.total}</span>
              </div>
              <div className={styles.nudgeItem}>
                <span className={styles.label}>High Priority</span>
                <span className={`${styles.value} ${styles.highPriority}`}>
                  {report.summary.nudgesSummary.byPriority.high || 0}
                </span>
              </div>
              <div className={styles.nudgeItem}>
                <span className={styles.label}>Medium Priority</span>
                <span className={`${styles.value} ${styles.mediumPriority}`}>
                  {report.summary.nudgesSummary.byPriority.medium || 0}
                </span>
              </div>
              <div className={styles.nudgeItem}>
                <span className={styles.label}>Low Priority</span>
                <span className={`${styles.value} ${styles.lowPriority}`}>
                  {report.summary.nudgesSummary.byPriority.low || 0}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Key Moments */}
        <section className={styles.section}>
          <h2>Key Moments</h2>
          <div className={styles.keyMoments}>
            {report.summary.keyMoments.length > 0 ? (
              <div className={styles.momentsList}>
                {report.summary.keyMoments.map((moment, idx) => (
                  <div key={idx} className={`${styles.moment} ${styles[`moment${capitalizeFirst(moment.type)}`]}`}>
                    <div className={styles.momentBadge}>{moment.type}</div>
                    <div className={styles.momentContent}>
                      <div className={styles.momentDescription}>{moment.description}</div>
                      <div className={styles.momentTime}>
                        {formatTime(moment.timestamp)}
                      </div>
                    </div>
                    <div className={styles.momentScore}>{Math.round(moment.engagementScore)}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noData}>No key moments recorded</div>
            )}
          </div>
        </section>

        {/* Strengths */}
        {report.summary.strengths.length > 0 && (
          <section className={styles.section}>
            <h2>Strengths</h2>
            <div className={styles.insights}>
              {report.summary.strengths.map((strength, idx) => (
                <div key={idx} className={styles.insightItem}>
                  <span className={styles.icon}>✓</span>
                  <span>{strength}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Areas for Improvement */}
        {report.summary.areasForImprovement.length > 0 && (
          <section className={styles.section}>
            <h2>Areas for Improvement</h2>
            <div className={styles.insights}>
              {report.summary.areasForImprovement.map((area, idx) => (
                <div key={idx} className={`${styles.insightItem} ${styles.warning}`}>
                  <span className={styles.icon}>!</span>
                  <span>{area}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section className={styles.section}>
            <h2>Recommendations for Next Session</h2>
            <div className={styles.recommendations}>
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`${styles.recommendationCard} ${styles[`priority${capitalizeFirst(rec.priority)}`]}`}
                >
                  <div className={styles.recHeader}>
                    <span className={styles.recCategory}>{rec.category}</span>
                    <span className={styles.recPriority}>{rec.priority}</span>
                  </div>
                  <div className={styles.recSuggestion}>{rec.suggestion}</div>
                  <div className={styles.recReason}>Reason: {rec.reason}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Export Section */}
        <section className={styles.section}>
          <h2>Export Data</h2>
          <div className={styles.exportButtons}>
            <button onClick={handleDownloadJSON} className={styles.exportBtn}>
              Download JSON
            </button>
            <button onClick={handleDownloadCSV} className={styles.exportBtn}>
              Download CSV
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

// Helper component for engagement timeline
function EngagementTimeline({ timeline }: { timeline: any[] }) {
  const maxScore = 100;
  return (
    <svg width="100%" height="200" viewBox="0 0 800 200" className={styles.svg}>
      <defs>
        <linearGradient id="engagementGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 0.3 }} />
          <stop offset="100%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      {timeline.slice(0, 20).map((moment, i) => {
        const x = (i / 19) * 750 + 25;
        const y = 150 - (moment.engagementScore / maxScore) * 120;
        return (
          <circle key={i} cx={x} cy={y} r="4" fill="rgb(59, 130, 246)" opacity="0.7" />
        );
      })}

      <line x1="25" y1="150" x2="775" y2="150" stroke="rgb(80, 80, 80)" strokeWidth="1" />
      <line x1="25" y1="30" x2="25" y2="150" stroke="rgb(80, 80, 80)" strokeWidth="1" />

      <text x="10" y="40" fontSize="12" fill="rgb(150, 150, 150)">
        100%
      </text>
      <text x="10" y="155" fontSize="12" fill="rgb(150, 150, 150)">
        0%
      </text>
    </svg>
  );
}

// Helper component for talk time pie chart
function TalkTimeChart({ ratio }: { ratio: { tutor: number; student: number } }) {
  const size = 200;
  const radius = 70;
  const cx = size / 2;
  const cy = size / 2;

  const tutorPercent = ratio.tutor * 100;
  const studentPercent = ratio.student * 100;

  const tutorAngle = (tutorPercent / 100) * 360;
  const studentAngle = (studentPercent / 100) * 360;

  const getCoords = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const tutorEnd = getCoords(tutorAngle);
  const largeArc = tutorAngle > 180 ? 1 : 0;

  const pathData = [
    `M ${cx} ${cy}`,
    `L ${cx} ${cy - radius}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${tutorEnd.x} ${tutorEnd.y}`,
    'Z',
  ].join(' ');

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Tutor */}
        <path d={pathData} fill="rgb(59, 130, 246)" />
        {/* Student */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgb(34, 197, 94)" strokeWidth={radius} />
      </svg>
      <div style={{ marginTop: '12px' }}>
        <div style={{ color: 'rgb(59, 130, 246)', fontSize: '14px', fontWeight: '600' }}>
          Tutor: {Math.round(tutorPercent)}%
        </div>
        <div style={{ color: 'rgb(34, 197, 94)', fontSize: '14px', fontWeight: '600' }}>
          Student: {Math.round(studentPercent)}%
        </div>
      </div>
    </div>
  );
}

// Helper functions
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
