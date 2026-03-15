'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSessions } from '@/lib/persistence/SessionStorage';
import { SessionSummarizer } from '@/lib/reports/SessionSummarizer';
import { SessionSummary } from '@/lib/reports/SessionSummarizer';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { StudentProfile } from '@/components/dashboard/StudentProfile';
import styles from './page.module.css';

interface SessionListItem {
  id: string;
  date: number;
  subject: string;
  studentName: string;
  duration: number;
  engagementScore: number;
  studentState: Record<string, number>;
  sessionType: string;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const allSessions = await listSessions();

        if (allSessions.length === 0) {
          setLoading(false);
          return;
        }

        // Generate summaries
        const summarizer = new SessionSummarizer();
        const generatedSummaries: SessionSummary[] = [];
        const processedSessions: SessionListItem[] = [];

        for (const session of allSessions) {
          const summary = summarizer.summarize(
            session.metricsHistory,
            session.nudgeHistory,
            session.config
          );
          generatedSummaries.push(summary);

          processedSessions.push({
            id: session.id,
            date: session.startTime,
            subject: session.config.subject,
            studentName: session.config.studentName,
            duration: summary.duration,
            engagementScore: summary.overallEngagement,
            studentState: summary.studentStateBreakdown,
            sessionType: session.config.sessionType,
          });
        }

        // Sort by date (newest first)
        processedSessions.sort((a, b) => b.date - a.date);

        setSessions(processedSessions);
        setSummaries(generatedSummaries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p>Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
          <h2>Error Loading Dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Calculate summary stats
  const totalSessions = sessions.length;
  const avgEngagement =
    totalSessions > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.engagementScore, 0) / totalSessions)
      : 0;
  const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalTimeMinutes = Math.round(totalTime / 60000);

  // Group sessions by student
  const studentSessions: Record<string, SessionListItem[]> = {};
  sessions.forEach((session) => {
    if (!studentSessions[session.studentName]) {
      studentSessions[session.studentName] = [];
    }
    studentSessions[session.studentName].push(session);
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Session Dashboard</h1>
          <p className={styles.subtitle}>Track and analyze tutoring sessions</p>
        </div>
        <Link href="/session" className={styles.startBtn}>
          Start New Session
        </Link>
      </header>

      <main className={styles.content}>
        {totalSessions === 0 ? (
          // Empty state
          <section className={styles.emptyState}>
            <div className={styles.emptyContent}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgb(150, 150, 150)"
                strokeWidth="1.5"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <h2>No Sessions Yet</h2>
              <p>Start your first tutoring session to see analytics and insights here.</p>
              <Link href="/session" className={styles.emptyBtn}>
                Start First Session
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Summary Stats */}
            <section className={styles.summaryStats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>{totalSessions}</div>
                <div className={styles.statLabel}>Total Sessions</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{avgEngagement}%</div>
                <div className={styles.statLabel}>Average Engagement</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{totalTimeMinutes}m</div>
                <div className={styles.statLabel}>Total Time Tutored</div>
              </div>
            </section>

            {/* Trend Charts */}
            <TrendCharts sessions={summaries} />

            {/* Student Profiles */}
            {Object.entries(studentSessions).length > 0 && (
              <section className={styles.section}>
                <h2>Student Profiles</h2>
                <div className={styles.studentGrid}>
                  {Object.entries(studentSessions).map(([studentName, studentSessionList]) => (
                    <StudentProfile
                      key={studentName}
                      studentName={studentName}
                      sessions={summaries.filter((s, i) =>
                        sessions[i]?.studentName === studentName
                      )}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Sessions List */}
            <section className={styles.section}>
              <h2>All Sessions</h2>
              <div className={styles.sessionsList}>
                <div className={styles.sessionsHeader}>
                  <div className={styles.colDate}>Date</div>
                  <div className={styles.colSubject}>Subject</div>
                  <div className={styles.colStudent}>Student</div>
                  <div className={styles.colDuration}>Duration</div>
                  <div className={styles.colEngagement}>Engagement</div>
                  <div className={styles.colAction}></div>
                </div>

                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/reports/${session.id}`}
                    className={styles.sessionRow}
                  >
                    <div className={styles.colDate}>
                      {new Date(session.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className={styles.colSubject}>
                      <span className={styles.sessionType}>{session.sessionType}</span>
                      {session.subject}
                    </div>
                    <div className={styles.colStudent}>{session.studentName}</div>
                    <div className={styles.colDuration}>
                      {formatDuration(session.duration)}
                    </div>
                    <div className={styles.colEngagement}>
                      <div className={styles.engagementBar}>
                        <div
                          className={styles.engagementFill}
                          style={{ width: `${session.engagementScore}%` }}
                        />
                      </div>
                      <span className={styles.engagementValue}>
                        {Math.round(session.engagementScore)}%
                      </span>
                    </div>
                    <div className={styles.colAction}>
                      <span className={styles.viewArrow}>→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}
