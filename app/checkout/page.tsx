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

// TODO: Replace with actual payment links created in Convert & Flow dashboard
// After creating links in CnF, update these URLs:
//   Go to app.convertandflow.com → Payments → Products → [Product] → Create Payment Link
const SUBSCRIPTION_LINKS = {
  monthly: 'https://app.convertandflow.com/v2/location/EhGQpOdCewKAWNlZDRkH/products/6a9d613343d1d76deaedfeeb',
  annual: 'https://app.convertandflow.com/v2/location/EhGQpOdCewKAWNlZDRkH/products/6a9d613343d1d76deaedff02',
};

export default function CheckoutPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      setUser(session?.user ?? null);
      setChecking(false);
    };
    checkSession();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4D1D57] via-[#2D1035] to-[#1A0A20] flex items-center justify-center">
        <div className="text-white/60 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4D1D57] via-[#2D1035] to-[#1A0A20] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-[#FF7095]">Coach Cass AI</h1>
          <p className="text-white/40 text-sm">WANTED Woman</p>
        </div>

        {/* Main Message */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Choose Your Subscription</h2>
          <p className="text-white/60 leading-relaxed max-w-md mx-auto">
            Get unlimited access to your personal relationship coach.
            Cancel anytime. Beta pricing while we launch.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly Plan */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 hover:border-[#FF7095]/50 transition-colors">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Monthly</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-[#FF7095]">$10</span>
                <span className="text-white/40">/month</span>
              </div>
            </div>
            <ul className="text-left text-white/60 text-sm space-y-2">
              <li>✓ Unlimited AI chats</li>
              <li>✓ Personal coaching insights</li>
              <li>✓ Cancel anytime</li>
            </ul>
            <a
              href={SUBSCRIPTION_LINKS.monthly}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-[#FF7095] hover:bg-[#E11D69] text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Subscribe Monthly
            </a>
          </div>

          {/* Annual Plan */}
          <div className="bg-white/5 border-2 border-[#FF7095] rounded-2xl p-6 space-y-4 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF7095] text-white text-xs font-bold px-3 py-1 rounded-full">
              BEST VALUE
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Annual</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-[#FF7095]">$99</span>
                <span className="text-white/40">/year</span>
              </div>
              <p className="text-[#FF7095]/80 text-sm">Save $21/year</p>
            </div>
            <ul className="text-left text-white/60 text-sm space-y-2">
              <li>✓ Unlimited AI chats</li>
              <li>✓ Personal coaching insights</li>
              <li>✓ Cancel anytime</li>
              <li>✓ Priority support</li>
            </ul>
            <a
              href={SUBSCRIPTION_LINKS.annual}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-[#FF7095] hover:bg-[#E11D69] text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Subscribe Annual
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-white/10 space-y-4">
          <p className="text-white/40 text-sm">
            Payment processed securely through Convert and Flow (Stripe).
          </p>
          <p className="text-white/30 text-xs">
            Having trouble? Contact support at coach@wantedwoman.com
          </p>
          {user && (
            <button
              onClick={() => router.push('/chat')}
              className="inline-block border border-white/20 hover:border-white/40 text-white/60 hover:text-white font-medium py-2 px-6 rounded-xl transition-all duration-300 text-sm"
            >
              Back to Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
