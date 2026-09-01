import crypto from 'node:crypto';
import { logger } from '@/lib/utils/logger';

/**
 * CC-15 · Google Calendar OAuth helpers (events scope ONLY).
 *
 * The member connects their own Google Calendar so Coach Cass can place a
 * recurring check-in event on it. The OAuth consent requests ONLY
 * `https://www.googleapis.com/auth/calendar.events` — the app never reads
 * contacts/mail and never gains login access. This is calendar consent, not
 * sign-in: the "no Google/Apple OAuth" lock refers to authentication, and D8
 * explicitly authorizes connecting a real calendar.
 */

export const GOOGLE_CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_PRIMARY_CALENDAR_URL =
  'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * The OAuth client id/secret come from the Google Cloud console OAuth 2.0
 * credentials for this app. Read by name only — never hardcoded.
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: process.env.GOOGLE_CAL_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CAL_CLIENT_SECRET || '',
  };
}

export function isGoogleCalendarConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  return Boolean(clientId && clientSecret);
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

/**
 * Build the Google OAuth authorization URL. `access_type=offline` +
 * `prompt=consent` guarantees a refresh_token on first consent so the app can
 * keep the member's calendar in sync after the access token expires.
 */
export function buildAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CAL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the OAuth `code` (from the callback) for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<GoogleTokenResponse>;

  if (!res.ok || !data.access_token) {
    logger.error('Google OAuth token exchange failed', { status: res.status });
    throw new Error(`Google OAuth token exchange failed (${res.status})`);
  }

  return data as GoogleTokenResponse;
}

/**
 * Refresh an expired access token using the stored refresh_token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<GoogleTokenResponse>;

  if (!res.ok || !data.access_token) {
    logger.error('Google token refresh failed', { status: res.status });
    throw new Error('Google token refresh failed');
  }

  return data as GoogleTokenResponse;
}

/**
 * Revoke a Google token (best-effort — never throws). Called on disconnect.
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.warn('Google token revoke failed (non-fatal)', err);
  }
}

/**
 * Resolve the connected Google account email. The primary calendar's `id` is
 * the account's email address, so we fetch it from the Calendar API (the
 * events scope grants this read without an email/userinfo scope).
 */
export async function fetchPrimaryCalendarEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_PRIMARY_CALENDAR_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: unknown };
    return typeof data.id === 'string' && data.id.length > 0 ? data.id : null;
  } catch (err) {
    logger.warn('Failed to fetch primary calendar email', err);
    return null;
  }
}

/** Random opaque state value for the OAuth CSRF check. */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Constant-time comparison of the OAuth state (avoids CSRF). */
export function safeTimingEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
