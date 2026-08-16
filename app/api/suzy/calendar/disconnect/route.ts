import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { revokeToken } from '@/lib/google-calendar/oauth';
import { deleteCalendarReminderEvent } from '@/lib/google-calendar/calendar-events';

export async function DELETE() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: conn, error } = await supabase
      .from('calendar_connections')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .single();

    if (error || !conn) {
      return NextResponse.json({ success: true }); // Already disconnected
    }

    // Revoke the Google token server-side
    try {
      await revokeToken(conn.access_token);
    } catch {
      // Best effort — we still delete locally
    }

    // Delete the connection row
    await supabase.from('calendar_connections').delete().eq('user_id', user.id);

    // Clean up any calendar events
    await deleteCalendarReminderEvent(user.id).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('disconnect error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
