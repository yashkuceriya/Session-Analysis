'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { listSessions as loadLocalSessions } from '@/lib/persistence/SessionStorage';

interface Session {
  id: string;
  date: number;
  subject: string;
  studentName: string;
  duration: number;
  engagementScore: number;
  status?: 'completed' | 'active' | 'abandoned';
}

interface StudentInsight {
  name: string;
  sessions: Session[];
  totalSessions: number;
  avgEngagement: number;
  trend: 'improving' | 'declining' | 'stable';
  sparklineData: { value: number }[];
}

interface DashboardStats {
  totalSessions: number;
  avgEngagement: number;
  totalTeachingTime: string;
  activeStudents: number;
  engagementTrend: { name: string; engagement: number }[];
}

interface ComparisonState {
  isOpen: boolean;
  selectedIds: string[];
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [studentInsights, setStudentInsights] = useState<StudentInsight[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    avgEngagement: 0,
    totalTeachingTime: '0m',
    activeStudents: 0,
    engagementTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonState>({
    isOpen: false,
    selectedIds: [],
  });

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        let transformedSessions: Session[] = [];

        // Try API first
        try {
          const response = await fetch('/api/sessions');
          if (response.ok) {
            const data = await response.json();
            transformedSessions = (data.sessions || []).map((s: any) => ({
              id: s.id,
              date: s.startTime || (s.start_time ? new Date(s.start_time).getTime() : Date.now()),
              subject: s.config?.subject || 'Unknown',
              studentName: s.config?.studentName || 'Unknown',
              duration: s.duration || 0,
              engagementScore: Math.round(s.engagementScore || 0),
              status: s.status || 'completed',
            }));
          }
        } catch (apiErr) {
          console.warn('API fetch failed, trying IndexedDB');
        }

        // Fallback to IndexedDB if API returns no sessions
        if (transformedSessions.length === 0) {
          try {
            const localSessions = await loadLocalSessions();
            transformedSessions = localSessions.map((s: any) => ({
              id: s.id,
              date: s.startTime || s.date,
              subject: s.config?.subject || 'Unknown',
              studentName: s.config?.studentName || 'Unknown',
              duration: s.endTime ? (s.endTime - s.startTime) : 0,
              engagementScore: Math.round(
                s.metricsHistory?.[s.metricsHistory.length - 1]?.engagementScore || 0
              ),
              status: s.status || 'completed',
            }));
          } catch (dbErr) {
            console.warn('IndexedDB fetch also failed');
          }
        }

        transformedSessions.sort((a, b) => b.date - a.date);
        setSessions(transformedSessions);
        setFilteredSessions(transformedSessions);

        // Calculate student insights
        const studentMap = new Map<string, Session[]>();
        transformedSessions.forEach((session) => {
          const existing = studentMap.get(session.studentName) || [];
          studentMap.set(session.studentName, [...existing, session]);
        });

        const insights: StudentInsight[] = Array.from(studentMap.entries()).map(([name, studentSessions]) => {
          const sorted = [...studentSessions].sort((a, b) => a.date - b.date);
          const avgEng = Math.round(
            sorted.reduce((sum, s) => sum + s.engagementScore, 0) / sorted.length
          );

          // Calculate trend
          let trend: 'improving' | 'declining' | 'stable' = 'stable';
          if (sorted.length >= 2) {
            const recent = sorted.slice(-3).map(s => s.engagementScore);
            const older = sorted.slice(0, Math.min(3, sorted.length - 3)).map(s => s.engagementScore);
            const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
            const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

            if (recentAvg > olderAvg + 5) trend = 'improving';
            else if (recentAvg < olderAvg - 5) trend = 'declining';
          }

          return {
            name,
            sessions: sorted,
            totalSessions: sorted.length,
            avgEngagement: avgEng,
            trend,
            sparklineData: sorted.map(s => ({ value: s.engagementScore })),
          };
        });

        setStudentInsights(insights);

        // Calculate stats
        if (transformedSessions.length > 0) {
          const totalTime = transformedSessions.reduce((sum, s) => sum + s.duration, 0);
          const avgEng = Math.round(
            transformedSessions.reduce((sum, s) => sum + s.engagementScore, 0) /
              transformedSessions.length
          );
          const engagementTrend = transformedSessions.slice(0, 10).map((s, idx) => ({
            name: `Session ${idx + 1}`,
            engagement: s.engagementScore,
          }));

          setStats({
            totalSessions: transformedSessions.length,
            avgEngagement: avgEng,
            totalTeachingTime: formatDuration(totalTime),
            activeStudents: studentMap.size,
            engagementTrend: engagementTrend.reverse(),
          });
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }

    loadSessions();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <div className="flex flex-col items-center justify-center min-h-96">
          <div className="w-10 h-10 border-3 border-[var(--card-border)] border-t-blue-500 rounded-full animate-spin" />
          <p className="mt-4 text-[var(--muted)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isEmpty = sessions.length === 0;

  // Helper function to get engagement label
  const getEngagementLabel = (score: number): string => {
    if (score >= 70) return 'Excellent';
    if (score >= 40) return 'Good';
    return 'Needs improvement';
  };

  // Helper function to get engagement color
  const getEngagementColor = (score: number): string => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getEngagementDotColor = (score: number): string => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Helper function to compute trends
  const computeTrends = () => {
    if (sessions.length < 2) return { trend: 'stable', description: '' };

    const recent = sessions.slice(0, 5).map(s => s.engagementScore);
    const older = sessions.slice(5, 10).map(s => s.engagementScore);

    const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : 0;

    let trend = 'stable';
    let description = 'Your engagement has remained consistent.';

    if (recentAvg > olderAvg + 5) {
      trend = 'improving';
      description = 'Your engagement has been improving over recent sessions, indicating more active and meaningful discussions.';
    } else if (recentAvg < olderAvg - 5) {
      trend = 'declining';
      description = 'Your engagement levels have declined recently. Consider adjusting your approach in sessions.';
    }

    return { trend, description };
  };

  const { description: trendDescription } = computeTrends();

  // Handle student filter
  const handleStudentFilter = (studentName: string | null) => {
    setSelectedStudent(studentName);
    if (studentName) {
      setFilteredSessions(sessions.filter(s => s.studentName === studentName));
    } else {
      setFilteredSessions(sessions);
    }
  };

  // Handle comparison selection
  const toggleComparisonSelection = (sessionId: string) => {
    setComparison(prev => {
      const newSelectedIds = prev.selectedIds.includes(sessionId)
        ? prev.selectedIds.filter(id => id !== sessionId)
        : [...prev.selectedIds, sessionId];
      return { ...prev, selectedIds: newSelectedIds };
    });
  };

  const getLastSessionInfo = () => {
    if (sessions.length === 0) return null;
    const lastSession = sessions[0];
    const timeAgo = getRelativeTime(lastSession.date);
    return {
      studentName: lastSession.studentName,
      timeAgo,
      engagement: lastSession.engagementScore,
    };
  };

  const lastSession = getLastSessionInfo();

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="mx-4 sm:mx-6 lg:mx-8 mt-6 mb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-3 mb-1">
              <h1 className="text-4xl font-bold text-[var(--foreground)]">Dashboard</h1>
              <span className="text-[var(--accent)] font-semibold text-lg">Nerdy</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
              <p className="text-[var(--muted-light)] text-sm">{today}</p>
              <p className="text-[var(--muted)] text-sm">
                {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''} • {stats.avgEngagement}% avg engagement
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 border border-[var(--card-border)] hover:bg-[var(--card-hover)] text-[var(--foreground)] font-medium py-2 px-4 rounded-lg transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h2a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h2a1 1 0 001-1V9m-9 13l9 0" />
              </svg>
              Home
            </Link>
            <Link
              href="/session"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--accent)] to-orange-500 hover:from-[var(--accent-hover)] hover:to-orange-600 text-white font-medium py-2.5 px-5 rounded-xl transition-all duration-200 hover:shadow-lg shadow-md shadow-orange-500/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Session
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isEmpty ? (
          <div className="card flex flex-col items-center justify-center min-h-96 p-12 bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)]">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-[var(--accent)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m0 0h6M6 12a6 6 0 11-12 0 6 6 0 0112 0z"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-[var(--foreground)] mb-3">Start your first session</h2>
              <p className="text-[var(--muted-light)] mb-8 max-w-sm">Get real-time analytics on engagement, eye contact, and speaking patterns to improve your tutoring skills.</p>
              <Link
                href="/session"
                className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-105 transform"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m0 0l-2-1m2 1v2.5M14 4l-2 1m0 0l-2-1m2 1v2.5" />
                </svg>
                Start Session Now
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Recent Activity Welcome Section */}
            {lastSession && (
              <div className="card p-6 mb-8 bg-gradient-to-r from-orange-50 via-[var(--accent-subtle)] to-transparent border border-orange-200/50 shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">👋</span>
                  <h3 className="font-semibold text-[var(--foreground)]">Welcome back!</h3>
                </div>
                <p className="text-[var(--foreground)] text-base leading-relaxed">
                  Your last session was {lastSession.timeAgo} with{' '}
                  <span className="font-semibold text-[var(--accent)]">{lastSession.studentName}</span>. Engagement score was{' '}
                  <span className={`font-bold px-2 py-0.5 rounded ${getEngagementColor(lastSession.engagement)} bg-white bg-opacity-50`}>
                    {lastSession.engagement}%
                  </span>
                  .
                </p>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon="📚"
                label="Sessions"
                value={stats.totalSessions}
                descriptor={`${stats.totalSessions} session${stats.totalSessions !== 1 ? 's' : ''} total`}
                borderColor="border-t-blue-500"
              />
              <StatCard
                icon="📊"
                label="Engagement"
                value={`${stats.avgEngagement}%`}
                descriptor={getEngagementLabel(stats.avgEngagement)}
                borderColor="border-t-green-500"
              />
              <StatCard
                icon="⏱️"
                label="Teaching Time"
                value={stats.totalTeachingTime}
                descriptor={`${stats.totalTeachingTime} total`}
                borderColor="border-t-purple-500"
              />
              <StatCard
                icon="👥"
                label="Students"
                value={stats.activeStudents}
                descriptor={`${stats.activeStudents} unique student${stats.activeStudents !== 1 ? 's' : ''}`}
                borderColor="border-t-amber-500"
              />
            </div>

            {/* Engagement Trend Chart with Recharts */}
            {stats.engagementTrend.length > 0 && (
              <div className="card p-6 mb-8 shadow-sm hover:shadow-md transition-shadow">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Engagement Trend</h2>
                <p className="text-sm text-[var(--muted-light)] mb-6">Last {stats.engagementTrend.length} sessions</p>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.engagementTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--info, #3B82F6)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--info, #3B82F6)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-light)" style={{ fontSize: '12px' }} />
                      <YAxis stroke="var(--muted-light)" domain={[0, 100]} style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--card-border)',
                          borderRadius: '8px',
                          color: 'var(--foreground)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        }}
                        formatter={(value) => [`${value}%`, 'Engagement']}
                        cursor={{ stroke: 'var(--card-border)', strokeWidth: 2 }}
                      />
                      <ReferenceLine y={60} stroke="var(--card-border)" strokeDasharray="4" label={{ value: 'Target', position: 'right', fill: 'var(--muted-light)', fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="engagement"
                        stroke="var(--info, #3B82F6)"
                        fill="url(#engagementGradient)"
                        dot={{ fill: 'var(--info, #3B82F6)', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: 'var(--info, #3B82F6)' }}
                        strokeWidth={3}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Student Insights Section */}
            {studentInsights.length > 0 && (
              <div className="card overflow-hidden mb-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="px-6 py-4 border-b border-[var(--card-border)] bg-gradient-to-r from-[var(--card-hover)] to-transparent">
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Student Insights</h2>
                  <p className="text-xs text-[var(--muted-light)] mt-1">{studentInsights.length} student{studentInsights.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-[var(--card-border)]">
                  {studentInsights.map((insight) => (
                    <StudentInsightRow
                      key={insight.name}
                      insight={insight}
                      isSelected={selectedStudent === insight.name}
                      onSelect={() => handleStudentFilter(selectedStudent === insight.name ? null : insight.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Session History Table */}
            <div className="card overflow-hidden mb-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="px-6 py-4 border-b border-[var(--card-border)] bg-gradient-to-r from-[var(--card-hover)] to-transparent flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Session History</h2>
                    <span className="text-sm font-medium text-[var(--muted-light)] bg-[var(--card)] px-2.5 py-1 rounded-full">{filteredSessions.length}</span>
                  </div>
                  {selectedStudent && (
                    <p className="text-sm text-[var(--muted-light)] mt-1">
                      Filtered for <span className="font-semibold text-[var(--foreground)]">{selectedStudent}</span>
                      <button
                        onClick={() => handleStudentFilter(null)}
                        className="ml-3 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors"
                      >
                        Clear
                      </button>
                    </p>
                  )}
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[var(--card-hover)] to-transparent border-b-2 border-[var(--card-border)]">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                        Engagement
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-light)] uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--card-border)]">
                    {filteredSessions.map((session, index) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        isFirst={index === 0 && !selectedStudent}
                        engagementDotColor={getEngagementDotColor(session.engagementScore)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-[var(--card-border)]">
                {filteredSessions.map((session, index) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isFirst={index === 0 && !selectedStudent}
                    engagementDotColor={getEngagementDotColor(session.engagementScore)}
                  />
                ))}
              </div>
            </div>

            {/* Overall NL Summary */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">Overview</h3>
              <p className="text-[var(--foreground)] leading-relaxed">
                {trendDescription}
              </p>
            </div>

            {/* Tutor Effectiveness */}
            {(() => {
              const engagementStdDev = sessions.length > 0
                ? Math.round(Math.sqrt(sessions.reduce((sum, s) => sum + Math.pow(s.engagementScore - stats.avgEngagement, 2), 0) / sessions.length))
                : 0;
              const consistencyLabel = engagementStdDev < 10 ? 'Excellent' : engagementStdDev < 20 ? 'Good' : 'Variable';

              const subjectMap = new Map<string, { total: number; count: number }>();
              sessions.forEach(s => {
                const entry = subjectMap.get(s.subject) || { total: 0, count: 0 };
                entry.total += s.engagementScore;
                entry.count += 1;
                subjectMap.set(s.subject, entry);
              });
              let bestSubject = 'N/A';
              let bestSubjectAvg = 0;
              subjectMap.forEach((val, key) => {
                const avg = val.total / val.count;
                if (avg > bestSubjectAvg) {
                  bestSubjectAvg = avg;
                  bestSubject = key;
                }
              });

              const highEngagementCount = sessions.filter(s => s.engagementScore >= 70).length;
              const highEngagementPct = sessions.length > 0 ? Math.round((highEngagementCount / sessions.length) * 100) : 0;

              return (
                <div className="card p-6 mt-8 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Tutor Effectiveness</h3>
                  <p className="text-sm text-[var(--muted-light)] mb-6">Aggregate quality metrics across all sessions</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="card p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                      <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wider">Avg Engagement Driven</p>
                      <p className="text-3xl font-bold text-[var(--foreground)] mt-2">{stats.avgEngagement}%</p>
                      <p className="text-[var(--muted-light)] text-xs mt-2">
                        {stats.avgEngagement >= 70 ? 'Excellent' : stats.avgEngagement >= 40 ? 'Good' : 'Needs improvement'} across all sessions
                      </p>
                    </div>
                    <div className="card p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                      <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wider">Session Consistency</p>
                      <p className="text-3xl font-bold text-[var(--foreground)] mt-2">&plusmn;{engagementStdDev} points</p>
                      <p className="text-[var(--muted-light)] text-xs mt-2">{consistencyLabel} consistency</p>
                    </div>
                    <div className="card p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                      <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wider">Best Subject</p>
                      <p className="text-3xl font-bold text-[var(--foreground)] mt-2">{bestSubject}</p>
                      <p className="text-[var(--muted-light)] text-xs mt-2">{Math.round(bestSubjectAvg)}% avg engagement</p>
                    </div>
                    <div className="card p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                      <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wider">Sessions with High Engagement</p>
                      <p className="text-3xl font-bold text-[var(--foreground)] mt-2">{highEngagementCount} of {sessions.length}</p>
                      <p className="text-[var(--muted-light)] text-xs mt-2">{highEngagementPct}% of sessions scored 70+</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </main>

      {error && (
        <div className="fixed bottom-4 right-4 bg-[var(--danger-light)] border border-[var(--danger)] text-[var(--danger)] px-4 py-3 rounded-lg max-w-sm">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  descriptor,
  borderColor,
}: {
  icon: string;
  label: string;
  value: string | number;
  descriptor: string;
  borderColor: string;
}) {
  return (
    <div className="card p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-4xl font-bold text-[var(--foreground)] mt-3 group-hover:text-[var(--accent)] transition-colors">{value}</p>
          <p className="text-[var(--muted-light)] text-xs mt-3">{descriptor}</p>
        </div>
        <div className="text-4xl opacity-40 group-hover:opacity-60 transition-opacity group-hover:scale-110 transform duration-200">{icon}</div>
      </div>
    </div>
  );
}

function EngagementChart({ data }: { data: number[] }) {
  if (data.length === 0) return null;

  const width = 600;
  const height = 300;
  const padding = 50;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const maxValue = 100;
  const minValue = 0;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y, value };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Create gradient fill path
  const fillPath = `M ${points[0].x} ${points[0].y} ${polylinePoints} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

  // Theme-aware colors using CSS custom properties
  const getCssVar = (varName: string): string => {
    if (typeof window !== 'undefined') {
      return window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }
    // Fallback colors for SSR
    const fallbacks: { [key: string]: string } = {
      '--card-border': '#e8e5e0',
      '--muted': '#8c8579',
    };
    return fallbacks[varName] || '#000000';
  };

  const borderColor = getCssVar('--card-border');
  const mutedColor = getCssVar('--muted');

  return (
    <div className="flex justify-center overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        <defs>
          <linearGradient id="engagementGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--info, #3B82F6)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--info, #3B82F6)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Reference lines with labels */}
        {/* Fair line at 40 */}
        <g>
          <line
            x1={padding}
            y1={padding + chartHeight - ((40 - minValue) / (maxValue - minValue)) * chartHeight}
            x2={width - padding}
            y2={padding + chartHeight - ((40 - minValue) / (maxValue - minValue)) * chartHeight}
            stroke={borderColor}
            strokeWidth="1"
            strokeDasharray="4"
          />
          <text
            x={width - padding + 5}
            y={padding + chartHeight - ((40 - minValue) / (maxValue - minValue)) * chartHeight + 3}
            fontSize="10"
            fill={mutedColor}
          >
            Fair
          </text>
        </g>

        {/* Good line at 70 */}
        <g>
          <line
            x1={padding}
            y1={padding + chartHeight - ((70 - minValue) / (maxValue - minValue)) * chartHeight}
            x2={width - padding}
            y2={padding + chartHeight - ((70 - minValue) / (maxValue - minValue)) * chartHeight}
            stroke={borderColor}
            strokeWidth="1"
            strokeDasharray="4"
          />
          <text
            x={width - padding + 5}
            y={padding + chartHeight - ((70 - minValue) / (maxValue - minValue)) * chartHeight + 3}
            fontSize="10"
            fill={mutedColor}
          >
            Good
          </text>
        </g>

        {/* Y-axis grid lines and labels */}
        {[0, 25, 50, 75, 100].map((gridValue) => {
          const y = padding + chartHeight - ((gridValue - minValue) / (maxValue - minValue)) * chartHeight;
          return (
            <g key={`grid-${gridValue}`}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke={borderColor} strokeWidth="1" strokeDasharray="4" opacity="0.5" />
              <text x={padding - 10} y={y + 4} fontSize="11" fill={mutedColor} textAnchor="end">
                {gridValue}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke={borderColor} strokeWidth="2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={borderColor} strokeWidth="2" />

        {/* Gradient fill under line */}
        <path d={fillPath} fill="url(#engagementGradient)" />

        {/* Polyline */}
        <polyline points={polylinePoints} fill="none" stroke="var(--info, #3B82F6)" strokeWidth="2" />

        {/* Data points with hover titles */}
        {points.map((point, index) => (
          <g key={`point-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="var(--info, #3B82F6)" />
            <circle cx={point.x} cy={point.y} r="6" fill="none" stroke="var(--info, #3B82F6)" strokeWidth="1" opacity="0.3" />
            <title>{`Session ${index + 1}: ${point.value}%`}</title>
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((point, index) => {
          if (index % Math.ceil(data.length / 5) === 0 || index === data.length - 1) {
            return (
              <text key={`label-${index}`} x={point.x} y={height - padding + 20} fontSize="11" fill={mutedColor} textAnchor="middle">
                {index + 1}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}

function SessionRow({
  session,
  isFirst,
  engagementDotColor,
}: {
  session: Session;
  isFirst: boolean;
  engagementDotColor: string;
}) {
  const engagementColor =
    session.engagementScore >= 70
      ? 'bg-green-50 text-green-700 border border-green-200'
      : session.engagementScore >= 40
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : 'bg-red-50 text-red-700 border border-red-200';

  const engagementLabel =
    session.engagementScore >= 70
      ? 'Excellent'
      : session.engagementScore >= 40
        ? 'Good'
        : 'Needs improvement';

  const statusColor =
    session.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
    session.status === 'active' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
    'bg-gray-50 text-gray-700 border border-gray-200';

  return (
    <Link href={`/analytics/${session.id}`}>
      <tr className="hover:bg-[var(--accent-light)] transition-colors duration-150 cursor-pointer border-b border-[var(--card-border)] last:border-b-0 hover:shadow-sm">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
          <div className="flex items-center gap-2">
            {isFirst && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-medium">Recent</span>}
            {formatDate(session.date)}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">{session.subject}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">{session.studentName}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted)]">
          {formatDuration(session.duration)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${engagementColor}`}>
            <span className={`w-2 h-2 rounded-full ${engagementDotColor}`} />
            {session.engagementScore}%
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${statusColor}`}>
            {session.status || 'Completed'}
          </span>
        </td>
      </tr>
    </Link>
  );
}

function SessionCard({
  session,
  isFirst,
  engagementDotColor,
}: {
  session: Session;
  isFirst: boolean;
  engagementDotColor: string;
}) {
  const engagementColor =
    session.engagementScore >= 70
      ? 'bg-green-50 text-green-700 border border-green-200'
      : session.engagementScore >= 40
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : 'bg-red-50 text-red-700 border border-red-200';

  const engagementLabel =
    session.engagementScore >= 70
      ? 'Excellent'
      : session.engagementScore >= 40
        ? 'Good'
        : 'Needs improvement';

  const statusColor =
    session.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
    session.status === 'active' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
    'bg-gray-50 text-gray-700 border border-gray-200';

  return (
    <Link href={`/analytics/${session.id}`}>
      <div className="p-4 hover:bg-[var(--accent-light)] transition-colors duration-150 cursor-pointer border-b border-[var(--card-border)] last:border-b-0">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-[var(--muted-light)]">{formatDate(session.date)}</p>
              {isFirst && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-200">Recent</span>}
            </div>
            <p className="font-semibold text-[var(--foreground)]">{session.subject}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${engagementColor}`}>
            <span className={`w-2 h-2 rounded-full ${engagementDotColor}`} />
            {session.engagementScore}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          <div>
            <p className="text-[var(--muted-light)] font-medium">Student</p>
            <p className="text-[var(--foreground)]">{session.studentName}</p>
          </div>
          <div>
            <p className="text-[var(--muted-light)] font-medium">Duration</p>
            <p className="text-[var(--foreground)]">{formatDuration(session.duration)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
            {session.status || 'Completed'}
          </span>
          <span className="text-xs text-[var(--muted-light)]">{engagementLabel}</span>
        </div>
      </div>
    </Link>
  );
}

function formatDate(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'No date';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins === 0 ? 'Just now' : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  } else if (remainingMinutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${remainingMinutes}m`;
  }
}

function getRelativeTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins === 0 ? 'just now' : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

function StudentInsightRow({
  insight,
  isSelected,
  onSelect,
}: {
  insight: StudentInsight;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const trendEmoji =
    insight.trend === 'improving'
      ? '📈'
      : insight.trend === 'declining'
        ? '📉'
        : '➡️';

  const trendColor =
    insight.trend === 'improving'
      ? 'text-green-600'
      : insight.trend === 'declining'
        ? 'text-red-600'
        : 'text-amber-600';

  const trendLabel =
    insight.trend === 'improving'
      ? 'Improving'
      : insight.trend === 'declining'
        ? 'Declining'
        : 'Stable';

  const avatarBg = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-pink-100', 'bg-yellow-100'];
  const avatarBgColor = avatarBg[insight.name.length % avatarBg.length];
  const initials = insight.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <button
      onClick={onSelect}
      className={`w-full px-6 py-5 text-left hover:bg-[var(--card-hover)] transition-all duration-150 ${
        isSelected ? 'bg-[var(--card-hover)]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-10 h-10 rounded-full ${avatarBgColor} flex items-center justify-center font-semibold text-sm text-gray-700`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[var(--foreground)]">{insight.name}</h3>
            <p className="text-sm text-[var(--muted-light)] mt-0.5">
              {insight.totalSessions} session{insight.totalSessions !== 1 ? 's' : ''} • {insight.avgEngagement}% avg
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className={`text-sm font-semibold ${trendColor}`}>
              {trendEmoji}
            </p>
            <p className="text-xs text-[var(--muted-light)]">{trendLabel}</p>
          </div>
          <div className="w-20 h-6">
            <SparklineChart data={insight.sparklineData} />
          </div>
          <Link
            href={`/progress/${encodeURIComponent(insight.name)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-purple-500 hover:text-purple-700 transition-colors"
            title="View student progress"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </Link>
          {isSelected && (
            <div className="text-[var(--accent)]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function SparklineChart({ data }: { data: { value: number }[] }) {
  if (data.length === 0) return null;

  const width = 96;
  const height = 32;
  const padding = 2;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const maxValue = 100;
  const minValue = 0;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((d.value - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={width} height={height} className="w-full h-full">
      <polyline points={polylinePoints} fill="none" stroke="var(--info, #3B82F6)" strokeWidth="1.5" />
      {points.map((point, index) => (
        <circle key={`point-${index}`} cx={point.x} cy={point.y} r="1.5" fill="var(--info, #3B82F6)" />
      ))}
    </svg>
  );
}
