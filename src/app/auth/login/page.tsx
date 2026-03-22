/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import { useState, FormEvent, ChangeEvent, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const registered = searchParams.get('registered') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error || 'Invalid credentials');
      } else if (result?.ok) {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An error occurred during sign in');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch (err) {
      setError('Google sign in failed');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('github', { callbackUrl });
    } catch (err) {
      setError('GitHub sign in failed');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--background)] to-[var(--accent-light)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Nerdy Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)] rounded-xl mb-4 shadow-lg shadow-[var(--accent)]/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Nerdy</h1>
          <p className="text-[var(--muted)] text-sm">AI-Powered Tutoring Analysis</p>
        </div>

        {/* Success Message */}
        {registered && (
          <div className="mb-6 bg-[var(--success-light)] border border-[var(--success)] rounded-lg p-4 text-sm text-[var(--success)]">
            Account created successfully! Please sign in.
          </div>
        )}

        {/* Login Card */}
        <div className="card p-8 shadow-lg shadow-[var(--accent)]/10">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Welcome Back</h2>
            <p className="text-[var(--muted)] text-sm">Sign in to your tutoring session account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {error && (
              <div className="bg-[var(--danger-light)] border border-[var(--danger)] rounded-lg p-4 text-[var(--danger)] text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white border border-[var(--card-border)] text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)]">
                  Password
                </label>
                <span className="text-sm text-[var(--muted-light)]/50 cursor-not-allowed select-none">
                  Forgot?
                </span>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white border border-[var(--card-border)] text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--card-border)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-[var(--card)] text-[var(--muted)]">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white hover:bg-[var(--card-hover)] border border-[var(--card-border)] text-[var(--foreground)] font-medium rounded-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={handleGitHubSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white hover:bg-[var(--card-hover)] border border-[var(--card-border)] text-[var(--foreground)] font-medium rounded-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.603-3.369-1.343-3.369-1.343-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.544 2.914 1.186.092-.923.35-1.544.636-1.899-2.22-.253-4.555-1.112-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.272.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.375.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.138 18.192 20 14.435 20 10.017 20 4.484 15.522 0 10 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>GitHub</span>
            </button>
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-[var(--muted)]">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
              Create one
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <LoginContent />
    </Suspense>
  );
}
