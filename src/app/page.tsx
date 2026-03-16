'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useSessionStore } from '@/stores/sessionStore';
import { SessionType } from '@/lib/metrics-engine/types';
import { SessionHistory } from '@/components/analytics/SessionHistory';

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const startSession = useSessionStore((s) => s.startSession);

  const [config, setConfig] = useState({
    subject: 'Mathematics',
    sessionType: 'discussion' as SessionType,
    studentLevel: 'High School',
    tutorName: 'Tutor',
    studentName: 'Student',
  });

  const handleStart = () => {
    startSession(config);
    router.push('/session');
  };

  const inputClass = "w-full bg-white border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all";
  const labelClass = "block text-sm font-medium text-[var(--muted)] mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--background)] via-white to-orange-50/30 flex flex-col">
      {/* Header Navigation */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm sticky top-0 z-50">
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
          {session?.user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--muted)]">{session.user.name || session.user.email}</span>
              <button onClick={() => signOut()} className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors">Sign Out</button>
            </div>
          ) : (
            <Link href="/auth/login" className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">Sign In</Link>
          )}
        </nav>
      </header>

      <div className="flex-1 flex flex-col p-4">

      <div className="flex items-center justify-center flex-1">
        <div className="max-w-lg w-full">
          {/* Logo & title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--accent)] rounded-xl mb-4 shadow-lg shadow-[var(--accent)]/20">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-2">Session Analysis</h1>
            <p className="text-[var(--muted)] text-sm mb-3">
              AI-powered real-time engagement analysis for live tutoring sessions
            </p>
            <p className="text-[var(--muted-light)] text-xs">
              Track eye contact, speaking time, and engagement to improve your teaching.
            </p>
          </div>

          {/* Setup form */}
          <div className="card p-8 space-y-6 shadow-lg hover:shadow-xl transition-shadow border border-[var(--card-border)]">
          <div>
            <label className={labelClass}>Subject</label>
            <input
              type="text"
              value={config.subject}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              className={inputClass}
              placeholder="e.g., Mathematics, Physics..."
            />
          </div>

          <div>
            <label className={labelClass}>Session Type</label>
            <select
              value={config.sessionType}
              onChange={(e) => setConfig({ ...config, sessionType: e.target.value as SessionType })}
              className={inputClass}
            >
              <option value="lecture">Lecture / Explanation</option>
              <option value="practice">Practice / Review</option>
              <option value="discussion">Socratic Discussion</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Student Level</label>
            <select
              value={config.studentLevel}
              onChange={(e) => setConfig({ ...config, studentLevel: e.target.value })}
              className={inputClass}
            >
              <option value="Middle School">Middle School</option>
              <option value="High School">High School</option>
              <option value="College">College</option>
              <option value="Graduate">Graduate</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tutor Name</label>
              <input
                type="text"
                value={config.tutorName}
                onChange={(e) => setConfig({ ...config, tutorName: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Student Name</label>
              <input
                type="text"
                value={config.studentName}
                onChange={(e) => setConfig({ ...config, studentName: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              className="w-full py-3.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-[var(--accent)] to-orange-500 hover:from-[var(--accent-hover)] hover:to-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.01]"
            >
              Start Solo Session (Demo)
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 pt-3">
              <div className="flex-1 h-px bg-[var(--card-border)]" />
              <span className="text-xs text-[var(--muted-light)]">or join a live session</span>
              <div className="flex-1 h-px bg-[var(--card-border)]" />
            </div>

            {/* Live room */}
            <div className="pt-2">
              <p className="text-xs text-[var(--muted)] mb-3">
                Both tutor and student open their own tab with the same room code.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const room = Math.random().toString(36).slice(2, 8);
                    startSession(config);
                    router.push(`/session?room=${room}&role=tutor`);
                  }}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-semibold text-sm shadow-lg shadow-green-500/20 transition-all duration-200"
                >
                  Start as Tutor
                </button>
                <button
                  onClick={() => {
                    const room = prompt('Enter the room code from your tutor:');
                    if (room) {
                      startSession(config);
                      router.push(`/session?room=${room}&role=student`);
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all duration-200"
                >
                  Join as Student
                </button>
              </div>
            </div>
          </div>

          {/* Feature list */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { icon: '👁', label: 'Eye contact tracking', color: 'var(--success)' },
              { icon: '🎤', label: 'Speaking time balance', color: 'var(--accent)' },
              { icon: '⚡', label: 'Energy & engagement', color: 'var(--warning)' },
              { icon: '💡', label: 'AI coaching nudges', color: 'var(--info)' },
            ].map((item, i) => (
              <div key={i} className="card p-4 flex flex-col items-start gap-2 hover:shadow-md transition-shadow border border-[var(--card-border)]">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-xs font-medium text-[var(--foreground)]">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted-light)] text-center mt-4">
            All video processing happens locally in your browser. No video data is sent to any server.
          </p>

          {/* Session history */}
          <SessionHistory />
        </div>
      </div>
      </div>
    </div>
  );
}
