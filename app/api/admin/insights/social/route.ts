import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Admin auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmails = ['coach@wantedwoman.com', 'inspiremany@gmail.com'];
    if (!adminEmails.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Get latest aggregate insights
    const { data: aggregates, error: aggError } = await supabase
      .from('aggregate_insights')
      .select('*')
      .order('date', { ascending: false })
      .limit(7);

    if (aggError) {
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }

    // Get total user count and conversation count
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: totalConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true });

    // Get total insights count
    const { count: totalInsights } = await supabase
      .from('user_insights')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      aggregates: aggregates || [],
      stats: {
        totalUsers: totalUsers || 0,
        totalConversations: totalConversations || 0,
        totalInsights: totalInsights || 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch social insights', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}