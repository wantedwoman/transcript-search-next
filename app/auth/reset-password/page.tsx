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
      setMode(session?.user ? 'reset' : 'request');
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
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        if (resetError.message.toLowerCase().includes('rate limit')) {
          setError('Too many reset emails were requested. Please wait a few minutes and try again.');
          return;
        }
        setError(resetError.message);
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
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
    <div className="bg-surface text-on-surface font-body selection:bg-primary/30 selection:text-primary min-h-screen flex flex-col items-center justify-center overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-container-lowest to-surface"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-container-low/40 to-surface"></div>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-tertiary/20 rounded-full blur-3xl"></div>
      </div>

      <main className="relative z-10 w-full max-w-md px-6 space-y-8">
        <header className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-headline italic font-bold tracking-tighter text-primary">Coach Cass AI</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-on-surface leading-tight tracking-tight">
            {mode === 'reset' ? 'Set New Password' : 'Reset Your Password'}
          </h1>
          {mode === 'request' && (
            <p className="text-secondary/70 text-sm">
              Enter your email and we’ll send you a secure link to reset your password.
            </p>
          )}
        </header>

        {error && (
          <div className="bg-error-container/20 border border-error/30 rounded-lg px-4 py-3 text-error text-sm font-medium">
            {error}
          </div>
        )}

        {mode === 'checking' && (
          <div className="glass-panel p-8 md:p-10 rounded-lg text-center text-secondary/70">
            Checking your reset session...
          </div>
        )}

        {mode === 'request' && !success && (
          <div className="velvet-glow rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-outline-variant/10">
            <div className="glass-panel p-8 md:p-10 rounded-lg">
              {emailSent ? (
                <div className="text-center space-y-4">
                  <div className="bg-primary-container/20 border border-primary/30 rounded-lg px-4 py-3 text-primary text-sm font-medium">
                    Reset email sent. Check your inbox and spam folder.
                  </div>
                  <p className="text-sm text-secondary/70">
                    Open the email and tap the reset link to come back here and set a new password.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestReset} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest pl-2">Email</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 py-4 rounded-xl text-on-primary font-bold text-lg shadow-[0_10px_30px_rgba(255,112,149,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {mode === 'reset' && (
          success ? (
            <div className="text-center space-y-6">
              <div className="bg-primary-container/20 border border-primary/30 rounded-lg px-4 py-3 text-primary text-sm font-medium">
                Password updated successfully!
              </div>
              <a
                href="/"
                className="inline-block w-full bg-primary hover:bg-primary/90 py-4 rounded-xl text-on-primary font-bold text-lg shadow-[0_10px_30px_rgba(255,112,149,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 text-center"
              >
                Go to Login
              </a>
            </div>
          ) : (
            <div className="velvet-glow rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-outline-variant/10">
              <div className="glass-panel p-8 md:p-10 rounded-lg">
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="new-password" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest pl-2">New Password</label>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest pl-2">Confirm Password</label>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 py-4 rounded-xl text-on-primary font-bold text-lg shadow-[0_10px_30px_rgba(255,112,149,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                    {!loading && <span className="material-symbols-outlined" data-icon="check">check</span>}
                  </button>
                </form>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
