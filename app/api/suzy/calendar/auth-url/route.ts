import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { buildAuthUrl, generateOAuthState, isGoogleCalendarConfigured } from '@/lib/google-calendar/oauth';

/**
 * GET /api/suzy/calendar/auth-url
 * Returns the Google OAuth consent URL for connecting the member's calendar
 * (events scope ONLY — never contacts/mail/login). The member is already
 * signed in to Coach Cass; this is calendar consent, not sign-in.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json(
        { error: 'Google Calendar is not configured on this environment yet.' },
        { status: 503 }
      );
    }

    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/suzy/calendar/callback`;
    const state = generateOAuthState();

    const url = buildAuthUrl(state, redirectUri);

    // Store the state in an httpOnly cookie so the callback can verify the
    // redirect came from our consent request (CSRF protection).
    const response = NextResponse.json({ url });
    response.cookies.set('calendar_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600, // 10 minutes — long enough to complete consent.
    });
    return response;
  } catch (error) {
    logger.error('GET /api/suzy/calendar/auth-url error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
