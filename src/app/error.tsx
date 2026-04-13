'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Session Analysis] Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="flex items-center px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-lg text-[var(--foreground)]">Session Analysis</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">Something went wrong</h1>
          <p className="text-[var(--muted)] mb-2 leading-relaxed">
            An unexpected error occurred. This has been logged and we&apos;ll look into it.
          </p>
          {error.digest && (
            <p className="text-xs text-[var(--muted-light)] mb-6 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-medium transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-[var(--card)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-xl font-medium transition-colors border border-[var(--card-border)]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
