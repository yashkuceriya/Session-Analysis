'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/sessionStore';
import { SessionType } from '@/lib/metrics-engine/types';
import { SessionHistory } from '@/components/analytics/SessionHistory';

export default function Home() {
  const router = useRouter();
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

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Logo & title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Session Analysis</h1>
          <p className="text-gray-400">
            AI-powered real-time engagement analysis for live tutoring sessions
          </p>
        </div>

        {/* Setup form */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subject</label>
            <input
              type="text"
              value={config.subject}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g., Mathematics, Physics..."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Session Type</label>
            <select
              value={config.sessionType}
              onChange={(e) => setConfig({ ...config, sessionType: e.target.value as SessionType })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="lecture">Lecture / Explanation</option>
              <option value="practice">Practice / Review</option>
              <option value="discussion">Socratic Discussion</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Student Level</label>
            <select
              value={config.studentLevel}
              onChange={(e) => setConfig({ ...config, studentLevel: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="Middle School">Middle School</option>
              <option value="High School">High School</option>
              <option value="College">College</option>
              <option value="Graduate">Graduate</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tutor Name</label>
              <input
                type="text"
                value={config.tutorName}
                onChange={(e) => setConfig({ ...config, tutorName: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Student Name</label>
              <input
                type="text"
                value={config.studentName}
                onChange={(e) => setConfig({ ...config, studentName: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Solo mode */}
          <button
            onClick={handleStart}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors mt-2"
          >
            Start Solo Session (Demo)
          </button>

          {/* Live mode separator */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">or start a live session</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Live room mode */}
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-2">
              Both tutor and student open their own tab with the same room code.
              Each person&apos;s webcam and mic are analyzed independently.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const room = Math.random().toString(36).slice(2, 8);
                  startSession(config);
                  router.push(`/session?room=${room}&role=tutor`);
                }}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Join as Tutor
              </button>
              <button
                onClick={() => {
                  const room = prompt('Enter the room code from your tutor:');
                  if (room) {
                    startSession(config);
                    router.push(`/session?room=${room}&role=student`);
                  }
                }}
                className="flex-1 bg-purple-700 hover:bg-purple-600 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Join as Student
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-gray-900/50 rounded-xl border border-gray-800/50 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">What gets analyzed</h3>
          <ul className="space-y-1.5 text-xs text-gray-500">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Eye contact & attention tracking
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Speaking time balance
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
              Energy & engagement levels
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
              Real-time coaching nudges
            </li>
          </ul>
          <p className="text-[10px] text-gray-600 mt-3">
            All video processing happens locally in your browser. No video data is sent to any server.
          </p>
        </div>

        {/* Session history */}
        <SessionHistory />
      </div>
    </div>
  );
}
