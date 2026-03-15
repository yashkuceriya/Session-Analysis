'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listSessions, deleteSession, StoredSession } from '@/lib/persistence/SessionStorage';

export function SessionHistory() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions()
      .then((s) => {
        setSessions(s.sort((a, b) => b.startTime - a.startTime));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
    <div className="mt-6 card bg-opacity-50 p-4">
      <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Past Sessions</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {sessions.map((session) => {
          const duration = session.endTime
            ? Math.round((session.endTime - session.startTime) / 60000)
            : '...';
          const avgEngagement = session.metricsHistory.length > 0
            ? Math.round(
                session.metricsHistory.reduce((s, m) => s + m.engagementScore, 0) /
                session.metricsHistory.length
              )
            : '-';

          return (
            <button
              key={session.id}
              onClick={() => router.push(`/analytics/${session.id}`)}
              className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--card-hover)] hover:bg-[var(--card-border)] transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--foreground)] truncate">
                  {session.config.subject || 'Session'} — {session.config.sessionType}
                </p>
                <p className="text-xs text-[var(--muted-light)]">
                  {new Date(session.startTime).toLocaleDateString()} — {duration} min — Engagement: {avgEngagement}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  session.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                }`}>
                  {session.status}
                </span>
                <button
                  onClick={(e) => handleDelete(session.id, e)}
                  className="text-[var(--muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
