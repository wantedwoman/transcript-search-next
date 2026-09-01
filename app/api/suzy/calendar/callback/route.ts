import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  exchangeCodeForTokens,
  fetchPrimaryCalendarEmail,
  safeTimingEqual,
} from '@/lib/google-calendar/oauth';
import { saveCalendarConnection } from '@/lib/google-calendar/calendar-reminders';

/**
 * GET /api/suzy/calendar/callback
 * OAuth callback from Google after the member grants calendar.events consent.
 * Exchanges the code, stores the connection, and redirects back to the app.
 *
 * The callback redirects to /profile with a ?calendar= query param so the
 * ReminderSetup UI can reflect the new state.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');
  const next = searchParams.get('next') ?? '/profile';

  // CSRF check: the state must match the httpOnly cookie set when the consent
  // URL was requested.
  const cookieState = request.cookies.get('calendar_oauth_state')?.value;
  if (!state || !cookieState || !safeTimingEqual(state, cookieState)) {
    logger.warn('Calendar OAuth callback rejected: state mismatch');
    return NextResponse.redirect(`${origin}/${next}?calendar=error&reason=state_mismatch`);
  }

  if (oauthError || !code) {
    return NextResponse.redirect(`${origin}/${next}?calendar=error&reason=denied`);
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      // The member must be signed in to attach a calendar to their account.
      return NextResponse.redirect(`${origin}/?error=auth_required`);
    }

    const redirectUri = `${origin}/api/suzy/calendar/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Resolve the connected Google account email (primary calendar id). This
    // is best-effort — the events scope grants this read without email scope.
    const googleEmail = await fetchPrimaryCalendarEmail(tokens.access_token);

    await saveCalendarConnection({
      userId: user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresInSeconds: tokens.expires_in,
      googleEmail,
    });

    return NextResponse.redirect(`${origin}/${next}?calendar=connected`);
  } catch (err) {
    logger.error('Calendar OAuth callback error', err);
    return NextResponse.redirect(`${origin}/${next}?calendar=error&reason=exchange_failed`);
  }
}
