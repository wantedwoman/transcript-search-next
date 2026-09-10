'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'checking' | 'request' | 'reset';

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>('checking');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      // Check URL for token and email parameters (from branded reset email)
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const emailParam = params.get('email');

      if (token && emailParam) {
        // Pre-fill email from URL
        setEmail(emailParam);
        // Validate token immediately
        const isValid = await validateToken(token);
        if (isValid) {
          setMode('reset');
        } else {
          setError('This reset link is invalid or has expired. Please request a new one.');
          setMode('request');
        }
      } else if (session?.user) {
        setMode('reset');
      } else {
        setMode('request');
      }
    };

    const validateToken = async (token: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/auth/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        return data.valid || false;
      } catch {
        return false;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY' || session?.user) {
        setError(null);
        setEmailSent(false);
        setMode('reset');
      }
    });

    init();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      setEmailSent(true);
    } catch {
      setError('Something went wrong sending the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get token from URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';

      if (!token) {
        // Fall back to session-based reset
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          setError(updateError.message);
          return;
        }

        setSuccess(true);
        return;
      }

      // Use custom API with token
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update password.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1a0a1e] text-white font-body selection:bg-[#FF7095]/30 selection:text-white min-h-screen flex flex-col items-center justify-center overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a1e] via-[#2d0a31] to-[#1a0a1e]"></div>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#FF7095]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-[#4D1D57]/30 rounded-full blur-3xl"></div>
      </div>

      <main className="relative z-10 w-full max-w-md px-6 space-y-8">
        <header className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7095] to-[#E11D69] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-2xl font-bold italic tracking-tighter text-[#FF7095]">Coach Cass AI</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight">
            {mode === 'reset' ? 'Set New Password' : 'Reset Your Password'}
          </h1>
          {mode === 'request' && (
            <p className="text-white/60 text-sm">
              Enter your email and we'll send you a secure link to reset your password.
            </p>
          )}
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm font-medium">
            {error}
          </div>
        )}

        {mode === 'checking' && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center text-white/60">
            Checking your reset session...
          </div>
        )}

        {mode === 'request' && !success && (
          <div className="bg-white/5 border border-white/10 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="p-8">
              {emailSent ? (
                <div className="text-center space-y-4">
                  <div className="bg-[#FF7095]/10 border border-[#FF7095]/30 rounded-lg px-4 py-3 text-[#FF7095] text-sm font-medium">
                    Reset email sent! Check your inbox (and spam folder).
                  </div>
                  <p className="text-sm text-white/60">
                    Open the email from Coach Cass AI and tap the reset link to set a new password.
                  </p>
                  <button
                    onClick={() => setEmailSent(false)}
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    Didn't receive it? Try again
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestReset} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-semibold text-white/80 uppercase tracking-widest pl-2">Email</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      className="w-full bg-[#0d0510] border border-[#4D1D57]/60 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FF7095]/60 focus:ring-1 focus:ring-[#FF7095]/40 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#FF7095] to-[#E11D69] hover:from-[#E11D69] hover:to-[#FF7095] py-3.5 rounded-xl text-white font-semibold text-lg shadow-lg shadow-[#FF7095]/25 hover:shadow-[#FF7095]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  <div className="text-center">
                    <a href="/auth/signup" className="text-sm text-white/40 hover:text-[#FF7095] transition-colors">
                      Don't have an account? Sign up
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {mode === 'reset' && (
          success ? (
            <div className="text-center space-y-6">
              <div className="bg-[#FF7095]/10 border border-[#FF7095]/30 rounded-lg px-4 py-3 text-[#FF7095] text-sm font-medium">
                Password updated successfully!
              </div>
              <a
                href="/"
                className="inline-block w-full bg-gradient-to-r from-[#FF7095] to-[#E11D69] hover:from-[#E11D69] hover:to-[#FF7095] py-3.5 rounded-xl text-white font-semibold text-lg shadow-lg shadow-[#FF7095]/25 hover:shadow-[#FF7095]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-center"
              >
                Go to Login
              </a>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="p-8">
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="new-password" className="block text-sm font-semibold text-white/80 uppercase tracking-widest pl-2">New Password</label>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#0d0510] border border-[#4D1D57]/60 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FF7095]/60 focus:ring-1 focus:ring-[#FF7095]/40 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="block text-sm font-semibold text-white/80 uppercase tracking-widest pl-2">Confirm Password</label>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#0d0510] border border-[#4D1D57]/60 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FF7095]/60 focus:ring-1 focus:ring-[#FF7095]/40 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#FF7095] to-[#E11D69] hover:from-[#E11D69] hover:to-[#FF7095] py-3.5 rounded-xl text-white font-semibold text-lg shadow-lg shadow-[#FF7095]/25 hover:shadow-[#FF7095]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>

                  <div className="text-center">
                    <a href="/auth/reset-password" className="text-sm text-white/40 hover:text-[#FF7095] transition-colors">
                      Back to reset request
                    </a>
                  </div>
                </form>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
