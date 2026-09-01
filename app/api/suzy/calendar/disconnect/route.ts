import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { disconnectCalendar } from '@/lib/google-calendar/calendar-reminders';

/**
 * DELETE /api/suzy/calendar/disconnect
 * Disconnects the member's Google Calendar. Existing calendar events are
 * cleaned up best-effort, the Google token is revoked, and the connection row
 * is removed. The in-app reminder (CC-08) keeps working — calendar is
 * additive, never a dependency.
 */
export async function DELETE() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await disconnectCalendar(user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/suzy/calendar/disconnect error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
