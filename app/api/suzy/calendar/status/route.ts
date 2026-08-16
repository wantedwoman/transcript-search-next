import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: conn, error } = await supabase
      .from('calendar_connections')
      .select('user_id, email, expires_at')
      .eq('user_id', user.id)
      .single();

    if (error || !conn) {
      return NextResponse.json({ connected: false });
    }

    const expiresAt = new Date(conn.expires_at);
    const isExpired = expiresAt.getTime() < Date.now();
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      connected: true,
      email: conn.email || user.email || 'unknown',
      expiresAt: conn.expires_at,
      isExpired,
      daysUntilExpiry: Math.max(0, daysUntilExpiry),
    });
  } catch (err) {
    console.error('status error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
