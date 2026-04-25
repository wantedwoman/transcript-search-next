'use client';

import React, { useState } from 'react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        if (loginError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (loginError.message.includes('Email not confirmed')) {
          setError('Please check your email and confirm your account before logging in.');
        } else {
          setError(loginError.message);
        }
        return;
      }

      // Successful login — redirect to chat
      window.location.href = '/chat';
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setResetSent(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary/30 selection:text-primary min-h-screen flex flex-col items-center justify-center overflow-x-hidden">
      {/* Hero Background Section */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-container-lowest to-surface"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-container-low/40 to-surface"></div>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-tertiary/20 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content Canvas */}
      <main className="relative z-10 w-full max-w-7xl px-6 py-12 md:flex md:items-center md:justify-center lg:px-24">
        <div className="w-full max-w-md space-y-8">
          <header className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-headline italic font-bold tracking-tighter text-primary">Suzy AI</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-headline font-bold text-tertiary leading-tight tracking-tight">
              Welcome back, <br />
              <span className="text-tertiary italic">Beautiful.</span>
            </h1>
            <p className="text-secondary max-w-sm text-lg font-light leading-relaxed">
              Step back into your sanctuary of personalized intelligence and effortless elegance.
            </p>
          </header>

          {/* Error Banner */}
          {error && (
            <div className="bg-error-container/20 border border-error/30 rounded-lg px-4 py-3 text-error text-sm font-medium">
              {error}
            </div>
          )}

          {/* Password Reset Success */}
          {resetSent && (
            <div className="bg-primary-container/20 border border-primary/30 rounded-lg px-4 py-3 text-primary text-sm font-medium">
              Check your email for a password reset link.
            </div>
          )}

          {/* Login/Reset Form Container */}
          <div className="velvet-glow rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-outline-variant/10">
            <div className="glass-panel p-8 md:p-10 rounded-lg">
              {resetMode ? (
                /* Password Reset Form */
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-headline font-bold text-on-surface">Reset Password</h2>
                    <p className="text-sm text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="reset-email" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest pl-2">Email Address</label>
                    <div className="relative">
                      <input
                        id="reset-email"
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 py-4 rounded-xl text-on-primary font-bold text-lg shadow-[0_10px_30px_rgba(255,112,149,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                    {!loading && <span className="material-symbols-outlined" data-icon="mail">mail</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setResetMode(false); setError(null); }}
                    className="w-full text-secondary hover:text-on-surface py-2 text-sm font-medium transition-colors"
                  >
                    ← Back to Login
                  </button>
                </form>
              ) : (
                /* Login Form */
                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest pl-2">Email Address</label>
                    <div className="relative">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-2">
                      <label htmlFor="password" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest">Password</label>
                      <button
                        type="button"
                        onClick={() => { setResetMode(true); setError(null); setResetSent(false); }}
                        className="text-xs text-primary/80 hover:text-primary transition-colors"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* Primary Action */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 py-4 rounded-xl text-on-primary font-bold text-lg shadow-[0_10px_30px_rgba(255,112,149,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Signing in...' : 'Login'}
                    {!loading && <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Footer Link */}
          <footer className="text-center md:text-left pt-4">
            <p className="text-on-surface-variant font-light">
              Don&apos;t have an account?
              <a className="text-primary font-bold ml-1 hover:underline underline-offset-8 transition-all" href="/auth/signup">Join the inner circle</a>
            </p>
          </footer>
        </div>
      </main>

      {/* Contextual Support Icon */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="w-14 h-14 bg-surface-container-highest rounded-full flex items-center justify-center shadow-lg border border-outline-variant/20 hover:border-tertiary/40 transition-all duration-300 group">
          <span className="material-symbols-outlined text-tertiary group-hover:rotate-12 transition-transform" data-icon="support_agent">support_agent</span>
        </button>
      </div>
    </div>
  );
}