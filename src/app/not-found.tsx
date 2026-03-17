import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="flex items-center px-6 py-4 border-b border-[var(--card-border)] bg-white/50 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-lg text-[var(--foreground)]">Nerdy</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="text-8xl font-extrabold text-[var(--accent)] opacity-20 mb-2">404</div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">Page not found</h1>
          <p className="text-[var(--muted)] mb-8 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            If you were looking for a session, it may have expired.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-medium transition-colors"
            >
              Back to Home
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-[var(--card)] hover:bg-[var(--card-hover)] text-[var(--foreground)] rounded-xl font-medium transition-colors border border-[var(--card-border)]"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
