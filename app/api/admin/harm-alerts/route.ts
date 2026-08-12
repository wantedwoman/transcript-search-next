import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';

const ADMIN_EMAILS = ['coach@wantedwoman.com', 'inspiremany@gmail.com'];

type HarmAlertRow = {
  id: string;
  user_id: string;
  message_snippet: string;
  matched_pattern: string;
  severity: 'high' | 'critical';
  acknowledged: boolean;
  created_at: string;
};

type UserProfileRow = {
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

    // Unacknowledged first, then acknowledged; newest first within each group.
    const { data: alerts, error } = await supabase
      .from('harm_alerts')
      .select('id, user_id, message_snippet, matched_pattern, severity, acknowledged, created_at')
      .order('acknowledged', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch harm alerts' }, { status: 500 });
    }

    const rows = (alerts || []) as HarmAlertRow[];
    const userIds = [...new Set(rows.map((a) => a.user_id))];

    let profileByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      if (!profileError) {
        profileByUserId = new Map(
          ((profiles || []) as UserProfileRow[]).map((p) => [p.user_id, p.email])
        );
      }
    }

    return NextResponse.json({
      alerts: rows.map((alert) => ({
        id: alert.id,
        userId: alert.user_id,
        email: profileByUserId.get(alert.user_id) || 'Unknown user',
        messageSnippet: alert.message_snippet,
        matchedPattern: alert.matched_pattern,
        severity: alert.severity,
        acknowledged: alert.acknowledged,
        createdAt: alert.created_at,
      })),
    });
  } catch (error) {
    console.error('Failed to list harm alerts', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
