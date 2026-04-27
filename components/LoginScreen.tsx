'use client';

import Link from 'next/link';
import { useState } from 'react';

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
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        window.location.href = '/chat';
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#2D0A31]">
      <div className="w-full max-w-md p-8">
        <h1 className="text-4xl font-bold text-center text-white mb-2">
          Suzy AI
        </h1>
        <p className="text-center text-[#F8A4D8] mb-8">
          Your relationship assistant, always in your pocket.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#F8A4D8] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#1A0A1E] border border-[#4D1D57] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF7095]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#F8A4D8] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#1A0A1E] border border-[#4D1D57] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF7095]"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#FF7095] text-white font-semibold hover:bg-[#E11D69] transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link
            href="/auth/reset-password"
            className="block text-sm text-[#F8A4D8] hover:text-[#FF7095]"
          >
            Forgot your password?
          </Link>
          <p className="text-sm text-gray-400">
            Don't have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-[#FF7095] hover:text-[#E11D69] font-medium"
            >
              Join the inner circle
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}