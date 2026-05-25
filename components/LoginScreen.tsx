'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        console.error('Login error:', error);
      } else {
        window.location.href = '/onboarding';
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      console.error('Login exception:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a1e] via-[#2D0A31] to-[#1a0a1e]" />
      
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FF7095]/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#4D1D57]/30 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Subtle grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Card glow border */}
        <div className="absolute -inset-[1px] bg-gradient-to-b from-[#FF7095]/30 via-[#4D1D57]/20 to-[#FF7095]/10 rounded-2xl blur-sm" />
        
        <div className="relative bg-[#1A0A1E]/80 backdrop-blur-xl rounded-2xl border border-[#4D1D57]/50 p-8 md:p-10 shadow-2xl">
          
          {/* Logo/Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7095] to-[#E11D69] flex items-center justify-center shadow-lg shadow-[#FF7095]/30">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-center text-white mb-2 tracking-tight">
            Coach Cass AI
          </h1>
          
          {/* Tagline */}
          <p className="text-center text-[#F8A4D8] text-lg mb-2 font-medium">
            Your Digital Confidante.
          </p>
          
          <p className="text-center text-white/40 text-sm mb-8">
            Always in your pocket. Always on your side.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span className="px-3 py-1 rounded-full bg-[#FF7095]/10 border border-[#FF7095]/20 text-[#FF7095] text-xs font-medium">
              💬 Relationship Advice
            </span>
            <span className="px-3 py-1 rounded-full bg-[#FF7095]/10 border border-[#FF7095]/20 text-[#FF7095] text-xs font-medium">
              ✨ Text Coaching
            </span>
            <span className="px-3 py-1 rounded-full bg-[#FF7095]/10 border border-[#FF7095]/20 text-[#FF7095] text-xs font-medium">
              🔒 Private & Safe
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-[#FF7095]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email address"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0d0510] border border-[#4D1D57]/60 text-white placeholder-white/30 focus:outline-none focus:border-[#FF7095]/60 focus:ring-1 focus:ring-[#FF7095]/40 transition-all"
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-[#FF7095]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0d0510] border border-[#4D1D57]/60 text-white placeholder-white/30 focus:outline-none focus:border-[#FF7095]/60 focus:ring-1 focus:ring-[#FF7095]/40 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF7095] to-[#E11D69] text-white font-semibold text-lg shadow-lg shadow-[#FF7095]/25 hover:shadow-[#FF7095]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div className="mt-8 text-center space-y-3">
            <Link
              href="/auth/reset-password"
              className="block text-sm text-[#F8A4D8]/70 hover:text-[#FF7095] transition-colors"
            >
              Forgot your password?
            </Link>
            <div className="h-px bg-gradient-to-r from-transparent via-[#4D1D57]/50 to-transparent" />
            <p className="text-sm text-white/50">
              Don't have an account?{' '}
              <Link
                href="/auth/signup"
                className="text-[#FF7095] hover:text-[#E11D69] font-semibold transition-colors"
              >
                Join the inner circle
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#4D1D57]/30 text-center">
            <p className="text-xs text-white/30">
              Part of the WANTED Woman ecosystem
            </p>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 text-center">
            <p className="text-[10px] text-white/20 leading-relaxed max-w-xs mx-auto">
              Coach Cass AI provides perspectives for personal growth and entertainment. This is not a replacement for professional therapy, counseling, or medical care. If you are in crisis, contact a licensed professional or emergency services.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
