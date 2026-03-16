/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type UserRole = 'tutor' | 'student';

export default function SignupPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as UserRole,
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    minLength: boolean;
    hasUppercase: boolean;
    hasNumber: boolean;
  }>({ minLength: false, hasUppercase: false, hasNumber: false });

  const validatePasswordStrength = (pwd: string) => {
    setPasswordStrength({
      minLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    });
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'password') {
      validatePasswordStrength(value);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate password strength
    if (!passwordStrength.minLength || !passwordStrength.hasUppercase || !passwordStrength.hasNumber) {
      setError('Password does not meet strength requirements');
      setIsLoading(false);
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Redirect to login on success
      router.push('/auth/login?registered=true');
    } catch (err) {
      setError('An error occurred during registration');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const isPasswordStrong = passwordStrength.minLength && passwordStrength.hasUppercase && passwordStrength.hasNumber;

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

        {/* Signup Card */}
        <div className="card p-8 shadow-lg shadow-[var(--accent)]/10">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Create Account</h2>
            <p className="text-[var(--muted)] text-sm">Join us to start analyzing tutoring sessions</p>
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
              <label htmlFor="name" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white border border-[var(--card-border)] text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white border border-[var(--card-border)] text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white border border-[var(--card-border)] text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
                required
                disabled={isLoading}
              />
              {formData.password && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className={`flex items-center gap-2 ${passwordStrength.minLength ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
                    <svg className={`w-4 h-4 flex-shrink-0 ${passwordStrength.minLength ? 'text-[var(--success)]' : 'text-[var(--muted-light)]'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordStrength.hasUppercase ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
                    <svg className={`w-4 h-4 flex-shrink-0 ${passwordStrength.hasUppercase ? 'text-[var(--success)]' : 'text-[var(--muted-light)]'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>One uppercase letter (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordStrength.hasNumber ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
                    <svg className={`w-4 h-4 flex-shrink-0 ${passwordStrength.hasNumber ? 'text-[var(--success)]' : 'text-[var(--muted-light)]'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>One number (0-9)</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white border border-[var(--card-border)] text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
                required
                disabled={isLoading}
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-sm text-[var(--danger)] mt-2">Passwords do not match</p>
              )}
            </div>

            {/* Role Selector */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-3">What's your role?</label>
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="tutor"
                    checked={formData.role === 'tutor'}
                    onChange={handleInputChange}
                    className="sr-only"
                    disabled={isLoading}
                  />
                  <div
                    className={`p-4 text-center rounded-lg border-2 font-medium transition-all ${
                      formData.role === 'tutor'
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : 'bg-white border-[var(--card-border)] text-[var(--foreground)] hover:border-[var(--accent)]'
                    }`}
                  >
                    Tutor
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={formData.role === 'student'}
                    onChange={handleInputChange}
                    className="sr-only"
                    disabled={isLoading}
                  />
                  <div
                    className={`p-4 text-center rounded-lg border-2 font-medium transition-all ${
                      formData.role === 'student'
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : 'bg-white border-[var(--card-border)] text-[var(--foreground)] hover:border-[var(--accent)]'
                    }`}
                  >
                    Student
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordStrong || formData.password !== formData.confirmPassword || !formData.name || !formData.email}
              className="w-full py-3 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-[var(--muted)]">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[var(--muted-light)] mt-6">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
