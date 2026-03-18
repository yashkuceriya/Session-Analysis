'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useSessionStore } from '@/stores/sessionStore';
import { SessionType } from '@/lib/metrics-engine/types';
import { SessionHistory } from '@/components/analytics/SessionHistory';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const startSession = useSessionStore((s) => s.startSession);
  const formRef = useRef<HTMLDivElement>(null);
  const errorParam = searchParams.get('error');

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

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const inputClass =
    'w-full bg-white border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all';
  const labelClass = 'block text-sm font-medium text-[var(--muted)] mb-1.5';

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)] bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-lg text-[var(--foreground)]">Nerdy</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            Dashboard
          </Link>
          {session?.user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--muted)]">{session.user.name || session.user.email}</span>
              <button
                onClick={() => signOut()}
                className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </header>

      {/* Error banner for redirects (e.g., invalid room token) */}
      {errorParam === 'invalid_token' && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-center">
          <p className="text-sm text-red-700 font-medium">
            Invalid or expired room link. Please ask for a new invite.
          </p>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-120px] right-[-80px] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-orange-200/40 to-transparent blur-3xl" />
          <div className="absolute bottom-[-100px] left-[-60px] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-blue-100/30 to-transparent blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-gradient-to-r from-orange-50/50 via-transparent to-blue-50/50 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-light)] border border-orange-200/60 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-xs font-medium text-[var(--accent)]">Live + AI Session Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.1] mb-6">
            Make every tutor
            <br />
            <span className="bg-gradient-to-r from-[var(--accent)] via-orange-500 to-amber-500 bg-clip-text text-transparent">
              more effective
            </span>
          </h1>

          <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Real-time engagement analytics, AI coaching nudges, and shareable progress reports
            that make tutoring measurable — for tutors, parents, and platform operators.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={scrollToForm}
              className="px-8 py-3.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-[var(--accent)] to-orange-500 hover:from-[var(--accent-hover)] hover:to-orange-600 text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5"
            >
              Start a Session
            </button>
            <Link
              href="/dashboard"
              className="px-8 py-3.5 text-sm font-semibold rounded-xl border border-[var(--card-border)] text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-all duration-200"
            >
              View Dashboard
            </Link>
          </div>

          <p className="text-xs text-[var(--muted-light)]">
            No signup required for demo sessions. All video stays in your browser.
          </p>

          {/* Hero visual — mock session UI */}
          <div className="mt-14 max-w-4xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/10 border border-[var(--card-border)] bg-[#0f0f17]">
              {/* Mock top bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-[#1a1a2d] border-b border-[#2a2a3d]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-[#6b6580] font-mono">nerdy — live session</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">Recording</span>
                </div>
              </div>
              {/* Mock content */}
              <div className="grid grid-cols-3 gap-3 p-4">
                {/* Video feeds */}
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div className="aspect-video rounded-xl bg-gradient-to-br from-[#2a2a3d] to-[#1a1a2d] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-[var(--accent)]/20 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-xs text-[#6b6580]">Tutor</span>
                    </div>
                  </div>
                  <div className="aspect-video rounded-xl bg-gradient-to-br from-[#2a2a3d] to-[#1a1a2d] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-xs text-[#6b6580]">Student</span>
                    </div>
                  </div>
                </div>
                {/* Mock sidebar */}
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#1a1a2d] border border-[#2a2a3d] p-3">
                    <div className="text-xs text-[#6b6580] mb-2">Engagement</div>
                    <div className="flex items-end gap-1 h-8">
                      {[40, 55, 60, 72, 68, 78, 85, 82, 90, 88, 92, 87].map((v, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm"
                          style={{
                            height: `${v}%`,
                            background: v > 75 ? '#22c55e' : v > 50 ? '#eab308' : '#ef4444',
                            opacity: 0.7 + (i / 40),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#1a1a2d] border border-[#2a2a3d] p-3">
                    <div className="text-xs text-[#6b6580] mb-1.5">Eye Contact</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#2a2a3d] overflow-hidden">
                        <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
                      </div>
                      <span className="text-xs text-blue-400 font-medium">78%</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#1a1a2d] border border-[#2a2a3d] p-3">
                    <div className="text-xs text-[#6b6580] mb-1.5">Talk Time</div>
                    <div className="flex gap-1">
                      <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: '45%' }} />
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: '55%' }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-[var(--accent)]">Tutor 45%</span>
                      <span className="text-[10px] text-emerald-400">Student 55%</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 text-xs mt-0.5">AI</span>
                      <span className="text-xs text-amber-200/80 leading-relaxed">
                        Try asking an open-ended question — student has been passive for 2 min.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Reflection glow */}
            <div className="h-20 bg-gradient-to-b from-black/5 to-transparent rounded-b-3xl -mt-1 mx-8 blur-sm" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[var(--foreground)] mb-3">
              Everything you need to understand your sessions
            </h2>
            <p className="text-[var(--muted)] max-w-xl mx-auto">
              Nerdy watches what matters so you can focus on teaching. Every metric is computed
              locally in your browser — nothing leaves your device.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ),
                title: 'Eye Contact Tracking',
                description: 'MediaPipe face mesh detects gaze direction in real-time for both tutor and student.',
                color: 'var(--accent)',
                bg: 'var(--accent-light)',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ),
                title: 'Speaking Balance',
                description: 'Voice activity detection measures who\'s talking and for how long, per participant.',
                color: 'var(--info)',
                bg: 'var(--info-light)',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'Expression Analysis',
                description: 'Detects smiles, confusion, concentration, and surprise to gauge emotional state.',
                color: '#22c55e',
                bg: 'var(--success-light)',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Engagement Score',
                description: 'A composite score that combines all signals into a single real-time engagement metric.',
                color: 'var(--warning)',
                bg: 'var(--warning-light)',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
                title: 'AI Coaching Nudges',
                description: 'Claude-powered suggestions appear when the student drifts or engagement drops.',
                color: '#8b5cf6',
                bg: '#f5f3ff',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                title: 'Post-Session Reports',
                description: 'Detailed breakdowns with timelines, key moments, strengths, and next-session recommendations.',
                color: 'var(--accent)',
                bg: 'var(--accent-light)',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ),
                title: 'Progress Visibility',
                description: 'Track engagement trends across sessions per student. Shareable with parents — no login required.',
                color: '#8b5cf6',
                bg: '#f5f3ff',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                ),
                title: 'Moments of Learning',
                description: 'AI-detected session highlights — engagement peaks, breakthroughs, and key moments shareable with parents.',
                color: '#ec4899',
                bg: '#fdf2f8',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group card p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border border-[var(--card-border)]"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: feature.bg, color: feature.color }}
                >
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1.5">{feature.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-gradient-to-b from-orange-50/40 to-transparent">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[var(--foreground)] text-center mb-12">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Set up your session',
                desc: 'Choose subject, session type, and participant names. Start solo or invite a student with a room code.',
              },
              {
                step: '2',
                title: 'Teach naturally',
                desc: 'Nerdy runs silently in the background, tracking engagement, expressions, and interaction patterns.',
              },
              {
                step: '3',
                title: 'Review insights',
                desc: 'Get a full report with engagement timeline, key moments, strengths, and actionable recommendations.',
              },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent)] to-orange-500 text-white font-bold text-lg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
                  {item.step}
                </div>
                <h3 className="font-semibold text-[var(--foreground)] mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy callout */}
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="card p-8 border border-[var(--card-border)] bg-gradient-to-r from-white to-blue-50/30">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1.5">Privacy-first by design</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  All video and audio processing happens locally in your browser using MediaPipe and Web Audio APIs.
                  No video frames, audio samples, or biometric data ever leave your device. Session metrics
                  are stored in your browser&apos;s IndexedDB unless you explicitly choose to sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Session Setup Form */}
      <section ref={formRef} className="py-16 px-6 bg-gradient-to-b from-transparent via-orange-50/30 to-transparent">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Start a session</h2>
            <p className="text-sm text-[var(--muted)]">Configure your session and jump in — it takes 10 seconds.</p>
          </div>

          <div className="card p-8 space-y-5 shadow-xl border border-[var(--card-border)]">
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

            <button
              onClick={handleStart}
              className="w-full py-3.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-[var(--accent)] to-orange-500 hover:from-[var(--accent-hover)] hover:to-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.01]"
            >
              Start Solo Session (Demo)
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-[var(--card-border)]" />
              <span className="text-xs text-[var(--muted-light)]">or join a live session</span>
              <div className="flex-1 h-px bg-[var(--card-border)]" />
            </div>

            {/* Live room */}
            <div>
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

          {/* Session history */}
          <SessionHistory />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--card-border)] py-8 px-6 mt-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--accent)] rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[var(--foreground)]">Nerdy</span>
          </div>
          <p className="text-xs text-[var(--muted-light)]">
            Built for better tutoring. All processing happens locally.
          </p>
        </div>
      </footer>
    </div>
  );
}
