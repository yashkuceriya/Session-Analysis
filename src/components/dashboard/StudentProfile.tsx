/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/refs */
'use client';

import { SessionSummary } from '@/lib/reports/SessionSummarizer';
import styles from './StudentProfile.module.css';

interface StudentProfileProps {
  studentName: string;
  sessions: SessionSummary[];
}

export function StudentProfile({ studentName, sessions }: StudentProfileProps) {
  if (sessions.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.noData}>No session data for {studentName}</div>
      </div>
    );
  }

  const sessionCount = sessions.length;
  const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0) / 60000; // Convert to minutes
  const avgEngagement = sessions.reduce((sum, s) => sum + s.overallEngagement, 0) / sessions.length;

  // Calculate trend
  const recentSessions = sessions.slice(-5);
  const olderSessions = sessions.slice(0, Math.max(1, sessions.length - 5));

  const recentAvg =
    recentSessions.reduce((sum, s) => sum + s.overallEngagement, 0) / recentSessions.length;
  const olderAvg = olderSessions.reduce((sum, s) => sum + s.overallEngagement, 0) / olderSessions.length;

  const trend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable';
  const trendIcon =
    trend === 'improving' ? '↗' : trend === 'declining' ? '↘' : '→';

  const lastSession = sessions[sessions.length - 1];
  const lastSessionDate = new Date(lastSession.duration).toLocaleDateString();

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.name}>{studentName}</h3>
          <p className={styles.subtitle}>Student Profile</p>
        </div>
        <div className={styles.trend} data-trend={trend}>
          {trendIcon}
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Sessions</div>
          <div className={styles.statValue}>{sessionCount}</div>
        </div>

        <div className={styles.stat}>
          <div className={styles.statLabel}>Total Time</div>
          <div className={styles.statValue}>{Math.round(totalTime)}m</div>
        </div>

        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg Engagement</div>
          <div className={styles.statValue}>{Math.round(avgEngagement)}%</div>
        </div>

        <div className={styles.stat}>
          <div className={styles.statLabel}>Trend</div>
          <div className={styles.statValue}>{trend}</div>
        </div>
      </div>

      <div className={styles.engagement}>
        <div className={styles.engagementLabel}>Engagement Trend</div>
        <div className={styles.bar}>
          <div
            className={styles.fill}
            style={{ width: `${Math.max(0, Math.min(100, avgEngagement))}%` }}
          />
        </div>
        <div className={styles.engagementValue}>{Math.round(avgEngagement)}%</div>
      </div>

      {lastSession && (
        <div className={styles.lastSession}>
          <div className={styles.lastSessionLabel}>Last Session</div>
          <div className={styles.lastSessionDate}>Today</div>
          <div className={styles.lastSessionScore}>
            Engagement: {Math.round(lastSession.overallEngagement)}%
          </div>
        </div>
      )}
    </div>
  );
}
