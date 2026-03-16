'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function SessionEndedInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'student';
  const duration = searchParams.get('duration');

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header Navigation */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-lg text-[var(--foreground)]">Nerdy</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Session Complete!</h1>

          {duration && (
            <p className="text-[var(--muted)] mb-4">
              Duration: {duration} minutes
            </p>
          )}

          <p className="text-[var(--foreground)]/70 mb-8 leading-relaxed">
            {role === 'student'
              ? 'Great work! Your tutor will review the session and share feedback with you.'
              : 'Session has ended successfully. View the analytics for detailed insights.'}
          </p>

          <div className="space-y-3">
            {role === 'tutor' && (
              <Link
                href="/dashboard"
                className="block w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-medium transition-colors"
              >
                View Dashboard
              </Link>
            )}
            <Link
              href="/"
              className="block w-full py-3 bg-[var(--card)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-xl font-medium transition-colors border border-[var(--card-border)]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SessionEndedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <SessionEndedInner />
    </Suspense>
  );
}
