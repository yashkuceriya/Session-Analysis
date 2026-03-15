'use client';

import { useState, useRef } from 'react';
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
        // If token fetch fails, continue without token (backward compatible)
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
      const params = new URLSearchParams({
        room: roomId,
        role,
        name: name,
      });
      if (roomToken) params.set('token', roomToken);
      router.push(`/session?${params.toString()}`);
    } catch (err) {
      setError('Failed to join session. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Join Tutoring Session</h1>
          <p className="text-gray-400 text-sm">
            Enter your details to join room
            <span className="font-mono ml-2 text-blue-400 font-semibold">{roomId}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`px-4 py-3 rounded-lg transition-colors font-medium text-sm ${
                    role === 'student'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  disabled={isLoading}
                >
                  Tutor
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium py-3 rounded-lg transition-colors mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
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
          <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-300">What happens next:</p>
            <ul className="space-y-1">
              <li>1. Video and microphone permissions are requested</li>
              <li>2. Connection establishes with the other participant</li>
              <li>3. Session analysis begins automatically</li>
            </ul>
          </div>
        </div>

        {/* Wait State Hint */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>If the tutor has not started yet...</p>
          <p className="text-gray-600 mt-1">
            You will see a waiting message in the session.
          </p>
        </div>
      </div>
    </div>
  );
}
