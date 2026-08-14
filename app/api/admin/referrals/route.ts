import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { ADMIN_EMAILS } from '@/lib/config/admin';

type ReferralRow = {
  id: string;
  referrer_user_id: string;
  referred_email: string;
  status: 'pending' | 'released' | 'paid';
  created_at: string;
  released_at: string | null;
};

type ProfileRow = {
  user_id: string;
  email: string;
};

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Fetch all referrals (admin scope — service role bypasses RLS)
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('id, referrer_user_id, referred_email, status, created_at, released_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
    }

    const rows = (referrals || []) as ReferralRow[];
    if (rows.length === 0) {
      return NextResponse.json({ referrals: [] });
    }

    // Collect distinct user IDs for profile lookup (referrer user_ids)
    const referrerUserIds = [...new Set(rows.map((r) => r.referrer_user_id))];
    let profileByUserId = new Map<string, string>();
    if (referrerUserIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, email')
        .in('user_id', referrerUserIds);

      if (!profileError && profiles) {
        for (const p of profiles as ProfileRow[]) {
          profileByUserId.set(p.user_id, p.email);
        }
      }
    }

    // Enrich each referral row with referrer email
    const enriched = rows.map((r) => ({
      id: r.id,
      referrerEmail: profileByUserId.get(r.referrer_user_id) ?? '(unknown)',
      referredEmail: r.referred_email,
      status: r.status,
      createdAt: r.created_at,
      releasedAt: r.released_at,
    }));

    return NextResponse.json({ referrals: enriched });
  } catch (err) {
    console.error('Failed to list referrals', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
