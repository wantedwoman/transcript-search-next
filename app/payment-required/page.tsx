'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function PaymentRequiredPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setChecking(false);
    };
    checkSession();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4D1D57] via-[#2D1035] to-[#1A0A20] flex items-center justify-center">
        <div className="text-white/60 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4D1D57] via-[#2D1035] to-[#1A0A20] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[#FF7095]">Coach Cass AI</h1>
          <p className="text-white/40 text-sm">WANTED Woman</p>
        </div>

        {/* Main Message */}
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#FF7095]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#FF7095]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Your Subscription Needs Attention</h2>
          <p className="text-white/60 leading-relaxed">
            Hey Sis, it looks like your payment method needs updating.
            Update your card to keep using Coach Cass AI.
          </p>
        </div>

        {/* Update Payment Button */}
        <div className="space-y-4">
          <a
            href="https://app.convertandflow.com/v2/location/EhGQpOdCewKAWNlZDRkH/customer-portal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full bg-[#FF7095] hover:bg-[#E11D69] text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
          >
            Update Payment Method
          </a>
          <p className="text-white/40 text-sm">
            Once you update your card, come back and log in again.
          </p>

          {/* Back to Login */}
          <button
            onClick={async () => {
              await getSupabaseClient().auth.signOut();
              router.push('/');
            }}
            className="inline-block w-full border border-white/20 hover:border-white/40 text-white/60 hover:text-white font-medium py-3 px-8 rounded-xl transition-all duration-300"
          >
            Back to Login
          </button>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-white/10">
          <p className="text-white/30 text-xs">
            Having trouble? Contact support at coach@wantedwoman.com
          </p>
        </div>
      </div>
    </div>
  );
}