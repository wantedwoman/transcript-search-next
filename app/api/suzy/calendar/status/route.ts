import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { getCalendarConnection } from '@/lib/google-calendar/calendar-reminders';
import { isGoogleCalendarConfigured } from '@/lib/google-calendar/oauth';

/**
 * GET /api/suzy/calendar/status
 * Returns whether the member has connected their Google Calendar, plus the
 * connected account email. NEVER returns tokens.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await getCalendarConnection(user.id);

    return NextResponse.json({
      connected: Boolean(connection),
      configured: isGoogleCalendarConfigured(),
      connection: connection
        ? {
            provider: connection.provider,
            google_email: connection.google_email,
            calendar_id: connection.calendar_id,
            created_at: connection.created_at,
          }
        : null,
    });
  } catch (error) {
    logger.error('GET /api/suzy/calendar/status error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
