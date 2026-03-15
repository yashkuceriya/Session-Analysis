'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Session {
  id: string;
  date: number;
  subject: string;
  studentName: string;
  duration: number;
  engagementScore: number;
  status?: 'completed' | 'active' | 'abandoned';
}

interface DashboardStats {
  totalSessions: number;
  avgEngagement: number;
  totalTeachingTime: string;
  activeStudents: number;
  engagementTrend: number[];
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    avgEngagement: 0,
    totalTeachingTime: '0m',
    activeStudents: 0,
    engagementTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        const response = await fetch('/api/sessions');
        if (!response.ok) throw new Error('Failed to fetch sessions');
        const data = await response.json();

        // Transform and sort sessions
        const transformedSessions: Session[] = (data.sessions || []).map((s: any) => ({
          id: s.id,
          date: s.startTime || s.date,
          subject: s.config?.subject || 'Unknown',
          studentName: s.config?.studentName || 'Unknown',
          duration: s.duration || 0,
          engagementScore: Math.round(s.engagementScore || 0),
          status: s.status || 'completed',
        }));

        transformedSessions.sort((a, b) => b.date - a.date);
        setSessions(transformedSessions);

        // Calculate stats
        if (transformedSessions.length > 0) {
          const totalTime = transformedSessions.reduce((sum, s) => sum + s.duration, 0);
          const avgEng = Math.round(
            transformedSessions.reduce((sum, s) => sum + s.engagementScore, 0) /
              transformedSessions.length
          );
          const uniqueStudents = new Set(transformedSessions.map((s) => s.studentName)).size;
          const engagementTrend = transformedSessions.slice(0, 10).map((s) => s.engagementScore);

          setStats({
            totalSessions: transformedSessions.length,
            avgEngagement: avgEng,
            totalTeachingTime: formatDuration(totalTime),
            activeStudents: uniqueStudents,
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
      <div className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
        <div className="flex flex-col items-center justify-center min-h-96">
          <div className="w-10 h-10 border-3 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          <p className="mt-4 text-gray-400">Loading dashboard...</p>
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Tutor Dashboard</h1>
            <p className="text-gray-400 text-sm mt-2">
              You've completed {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''} with an average engagement of {stats.avgEngagement}%
            </p>
          </div>
          <Link
            href="/session"
            className="inline-block bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/50"
          >
            New Session
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-96 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C6.5 6.253 2 10.753 2 16.5S6.5 26.747 12 26.747s10-4.5 10-10.247S17.5 6.253 12 6.253z"
                />
              </svg>
              <h2 className="text-2xl font-semibold text-white mb-2">No sessions yet</h2>
              <p className="text-gray-400 mb-6">No sessions yet. Start your first tutoring session to see analytics here.</p>
              <Link
                href="/session"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200"
              >
                Start First Session
              </Link>
            </div>
          </div>
        ) : (
          <>
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

            {/* Engagement Trend Chart */}
            {stats.engagementTrend.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Engagement Trend (Last 10 Sessions)</h2>
                <EngagementChart data={stats.engagementTrend} />
              </div>
            )}

            {/* Session History Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-gray-800">
                <h2 className="text-xl font-semibold text-white">Session History</h2>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800 border-b border-gray-700">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Engagement
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sessions.map((session, index) => (
                      <SessionRow key={session.id} session={session} isFirst={index === 0} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-800">
                {sessions.map((session, index) => (
                  <SessionCard key={session.id} session={session} isFirst={index === 0} />
                ))}
              </div>
            </div>

            {/* Overall NL Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Overview</h3>
              <p className="text-gray-300 leading-relaxed">
                {trendDescription}
              </p>
            </div>
          </>
        )}
      </main>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg max-w-sm">
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
    <div className={`bg-gray-900 border border-gray-800 border-t-2 ${borderColor} rounded-lg p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          <p className="text-gray-400 text-xs mt-2">{descriptor}</p>
        </div>
        <span className="text-3xl">{icon}</span>
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

  return (
    <div className="flex justify-center overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        <defs>
          <linearGradient id="engagementGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
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
            stroke="#666666"
            strokeWidth="1"
            strokeDasharray="4"
          />
          <text
            x={width - padding + 5}
            y={padding + chartHeight - ((40 - minValue) / (maxValue - minValue)) * chartHeight + 3}
            fontSize="10"
            fill="#999999"
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
            stroke="#666666"
            strokeWidth="1"
            strokeDasharray="4"
          />
          <text
            x={width - padding + 5}
            y={padding + chartHeight - ((70 - minValue) / (maxValue - minValue)) * chartHeight + 3}
            fontSize="10"
            fill="#999999"
          >
            Good
          </text>
        </g>

        {/* Y-axis grid lines and labels */}
        {[0, 25, 50, 75, 100].map((gridValue) => {
          const y = padding + chartHeight - ((gridValue - minValue) / (maxValue - minValue)) * chartHeight;
          return (
            <g key={`grid-${gridValue}`}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#374151" strokeWidth="1" strokeDasharray="4" opacity="0.5" />
              <text x={padding - 10} y={y + 4} fontSize="11" fill="#6B7280" textAnchor="end">
                {gridValue}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#4B5563" strokeWidth="2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#4B5563" strokeWidth="2" />

        {/* Gradient fill under line */}
        <path d={fillPath} fill="url(#engagementGradient)" />

        {/* Polyline */}
        <polyline points={polylinePoints} fill="none" stroke="#3B82F6" strokeWidth="2" />

        {/* Data points with hover titles */}
        {points.map((point, index) => (
          <g key={`point-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#3B82F6" />
            <circle cx={point.x} cy={point.y} r="6" fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.3" />
            <title>{`Session ${index + 1}: ${point.value}%`}</title>
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((point, index) => {
          if (index % Math.ceil(data.length / 5) === 0 || index === data.length - 1) {
            return (
              <text key={`label-${index}`} x={point.x} y={height - padding + 20} fontSize="11" fill="#6B7280" textAnchor="middle">
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
}: {
  session: Session;
  isFirst: boolean;
}) {
  const engagementColor =
    session.engagementScore >= 70
      ? 'bg-green-500/20 text-green-400'
      : session.engagementScore >= 40
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-red-500/20 text-red-400';

  const engagementLabel =
    session.engagementScore >= 70
      ? 'Excellent'
      : session.engagementScore >= 40
        ? 'Good'
        : 'Needs improvement';

  return (
    <Link href={`/analytics/${session.id}`}>
      <tr className="hover:bg-gray-800 transition-colors cursor-pointer border-b border-gray-800 last:border-b-0">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
          <div className="flex items-center gap-2">
            {isFirst && <span className="text-xs bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded">Most recent</span>}
            {formatDate(session.date)}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{session.subject}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{session.studentName}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
          {formatDuration(session.duration)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${engagementColor}`}>
            {session.engagementScore}% {engagementLabel}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
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
}: {
  session: Session;
  isFirst: boolean;
}) {
  const engagementColor =
    session.engagementScore >= 70
      ? 'bg-green-500/20 text-green-400'
      : session.engagementScore >= 40
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-red-500/20 text-red-400';

  const engagementLabel =
    session.engagementScore >= 70
      ? 'Excellent'
      : session.engagementScore >= 40
        ? 'Good'
        : 'Needs improvement';

  return (
    <Link href={`/analytics/${session.id}`}>
      <div className="p-4 hover:bg-gray-800 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-gray-400">{formatDate(session.date)}</p>
              {isFirst && <span className="text-xs bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded">Most recent</span>}
            </div>
            <p className="font-semibold text-white">{session.subject}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${engagementColor}`}>
            {session.engagementScore}%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-400">Student</p>
            <p className="text-gray-200">{session.studentName}</p>
          </div>
          <div>
            <p className="text-gray-400">Duration</p>
            <p className="text-gray-200">{formatDuration(session.duration)}</p>
          </div>
          <div>
            <p className="text-gray-400">Engagement</p>
            <p className={`text-sm font-medium ${engagementColor.replace(/px/, '').replace(/py/, '')}`}>
              {engagementLabel}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatDate(timestamp: number): string {
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
