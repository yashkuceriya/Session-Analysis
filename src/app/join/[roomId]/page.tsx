'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/sessionStore';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const startSession = useSessionStore((s) => s.startSession);

  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request room token for this session
      let roomToken: string | null = null;
      try {
        const tokenRes = await fetch('/api/rooms/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId }),
        });
        if (tokenRes.ok) {
          const { token } = await tokenRes.json();
          roomToken = token;
        }
      } catch {
        // Token service unavailable, continue without
      }

      // Start session with default config
      startSession({
        subject: 'Tutoring Session',
        sessionType: 'discussion',
        studentLevel: 'High School',
        tutorName: role === 'tutor' ? name : 'Tutor',
        studentName: role === 'student' ? name : 'Student',
      });

      // Redirect to session with room params
      const urlParams = new URLSearchParams({
        room: roomId,
        role,
        name: name,
      });
      if (roomToken) urlParams.set('token', roomToken);
      router.push(`/session?${urlParams.toString()}`);
    } catch {
      setError('Failed to join session. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Top navigation */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => router.push('/')}
          className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          Home
        </button>
      </div>

      <div className="flex items-center justify-center flex-1">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)] rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Join session icon">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Join Tutoring Session</h1>
          <p className="text-[var(--muted)] text-sm">
            Enter your details to join room
            <span className="font-mono ml-2 text-[var(--accent)] font-semibold">{roomId}</span>
          </p>
        </div>

          {/* Card */}
          <div className="card p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-[var(--card-hover)] border border-[var(--card-border)] rounded-lg px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                disabled={isLoading}
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`px-4 py-3 rounded-lg transition-colors font-medium text-sm ${
                    role === 'student'
                      ? 'bg-[var(--info)] text-white'
                      : 'bg-[var(--card-hover)] text-[var(--foreground)] border border-[var(--card-border)] hover:bg-[var(--card-border)]'
                  }`}
                  disabled={isLoading}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('tutor')}
                  className={`px-4 py-3 rounded-lg transition-colors font-medium text-sm ${
                    role === 'tutor'
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--card-hover)] text-[var(--foreground)] border border-[var(--card-border)] hover:bg-[var(--card-border)]'
                  }`}
                  disabled={isLoading}
                >
                  Tutor
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-[var(--danger-light)] border border-[var(--danger)] rounded-lg p-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-label="Loading"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Joining...
                </span>
              ) : (
                'Join Session'
              )}
              </button>
            </form>

            {/* Info Box */}
            <div className="bg-[var(--card-hover)] rounded-lg p-3 text-xs text-[var(--muted)] space-y-1">
              <p className="font-medium text-[var(--foreground)]">What happens next:</p>
              <ul className="space-y-1">
                <li>1. Video and microphone permissions are requested</li>
                <li>2. Connection establishes with the other participant</li>
                <li>3. Session analysis begins automatically</li>
              </ul>
            </div>
          </div>

          {/* Wait State Hint */}
          <div className="mt-6 text-center text-xs text-[var(--muted-light)]">
            <p>If the tutor has not started yet...</p>
            <p className="text-[var(--muted)] mt-1">
              You will see a waiting message in the session.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
