import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';
import { refreshAccessToken, revokeGoogleToken } from './oauth';

/**
 * CC-15 · Real-calendar reminders.
 *
 * Bridges the in-app reminder engine (lib/reminders/reminder-engine.ts) to the
 * member's Google Calendar. Calendar is ADDITIVE and never a dependency:
 * every function here fails soft — a missing connection, an expired token, or
 * a Google API error never breaks reminder creation, cancellation, or the
 * in-app check-in that always fires.
 */

export type CalendarCadence = 'daily' | 'weekly' | 'monthly';

export interface CalendarConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  google_email: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  calendar_id: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarReminderInput {
  userId: string;
  topic: string;
  remindAt: Date | string;
  cadence: CalendarCadence;
  /** App-side member email — fallback attendee when the Google email is unknown. */
  googleEmail?: string | null;
  /** Existing Google Calendar event id for the create/update path. */
  existingEventId?: string | null;
}

export interface CalendarSyncResult {
  synced: boolean;
  eventId?: string;
  eventLink?: string;
  reason?: string;
}

const CALENDAR_EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars';
const DEFAULT_EVENT_DURATION_MINUTES = 30;

/**
 * Google Calendar RRULE for the member-chosen cadence. `null` for an unknown
 * cadence → a one-off event.
 */
export function buildRecurrenceRule(cadence: CalendarCadence): string[] | null {
  switch (cadence) {
    case 'daily':
      return ['RRULE:FREQ=DAILY'];
    case 'weekly':
      return ['RRULE:FREQ=WEEKLY'];
    case 'monthly':
      return ['RRULE:FREQ=MONTHLY'];
    default:
      return null;
  }
}

/**
 * Build the Google Calendar event payload for a reminder. Exported for the
 * prove-fixed test so the request body can be asserted without a live API.
 */
export function buildCalendarEventPayload(input: CalendarReminderInput): Record<string, unknown> {
  const start = new Date(input.remindAt);
  const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60_000);
  const recurrence = buildRecurrenceRule(input.cadence);

  const payload: Record<string, unknown> = {
    summary: input.topic,
    description:
      'Coach Cass AI check-in reminder. Your in-app check-in fires regardless of calendar availability.',
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: true },
  };

  const attendeeEmail = input.googleEmail || null;
  if (attendeeEmail) {
    payload.attendees = [{ email: attendeeEmail }];
  }
  if (recurrence) {
    payload.recurrence = recurrence;
  }

  return payload;
}

/** Fetch a member's calendar connection (service-role; RLS hides it from clients). */
export async function getCalendarConnection(
  userId: string
): Promise<CalendarConnectionRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch calendar connection', error);
    return null;
  }
  return data as CalendarConnectionRow | null;
}

/**
 * Persist (or update) a member's calendar connection after the OAuth callback.
 * Google omits refresh_token on re-consent — preserve the stored one in that
 * case so we never lose refresh capability.
 */
export async function saveCalendarConnection(input: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  googleEmail: string | null;
}): Promise<void> {
  const supabase = createServiceRoleClient();

  const existing = await getCalendarConnection(input.userId);
  const refreshToken = input.refreshToken ?? existing?.refresh_token ?? null;

  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
  const now = new Date().toISOString();

  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: input.userId,
      provider: 'google',
      google_email: input.googleEmail ?? existing?.google_email ?? null,
      access_token: input.accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      calendar_id: existing?.calendar_id || 'primary',
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    logger.error('Failed to save calendar connection', error);
    throw new Error('Failed to save calendar connection');
  }

  logger.info(`Saved Google Calendar connection for user ${input.userId}`);
}

/**
 * Return a valid (unexpired) access token for a connection, refreshing and
 * persisting it when needed. Returns null when no refresh is possible.
 */
async function getValidAccessToken(
  connection: CalendarConnectionRow
): Promise<{ accessToken: string; connection: CalendarConnectionRow } | null> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const isFresh = expiresAt > Date.now() + 60_000;

  if (isFresh && connection.access_token) {
    return { accessToken: connection.access_token, connection };
  }

  if (!connection.refresh_token) {
    logger.warn(`Calendar connection for user ${connection.user_id} has no refresh token`);
    return null;
  }

  try {
    const tokens = await refreshAccessToken(connection.refresh_token);
    if (!tokens.access_token) return null;

    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('calendar_connections')
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', connection.user_id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to persist refreshed calendar token', error);
      return { accessToken: tokens.access_token, connection };
    }
    return { accessToken: tokens.access_token, connection: data as CalendarConnectionRow };
  } catch (err) {
    logger.error('Failed to refresh calendar token', err);
    return null;
  }
}

/**
 * Create (or update) the Google Calendar event for a reminder.
 *
 * Additive-only: no connection → returns `{ synced: false, reason:
 * 'no-calendar-connection' }` and the in-app reminder (CC-08) still fires.
 * Never throws.
 */
export async function syncReminderToCalendar(
  input: CalendarReminderInput
): Promise<CalendarSyncResult> {
  const connection = await getCalendarConnection(input.userId);
  if (!connection) {
    return { synced: false, reason: 'no-calendar-connection' };
  }

  const client = await getValidAccessToken(connection);
  if (!client) {
    return { synced: false, reason: 'token-unavailable' };
  }

  const calendarId = connection.calendar_id || 'primary';
  const payload = buildCalendarEventPayload({
    ...input,
    googleEmail: connection.google_email || input.googleEmail,
  });

  try {
    const method = input.existingEventId ? 'PUT' : 'POST';
    const url = input.existingEventId
      ? `${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.existingEventId)}`
      : `${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${client.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: unknown; htmlLink?: unknown };

    if (!res.ok) {
      logger.error('Google Calendar event sync failed', { status: res.status, method, url });
      return { synced: false, reason: `google-api-${res.status}` };
    }

    return {
      synced: true,
      eventId: typeof data.id === 'string' ? data.id : undefined,
      eventLink: typeof data.htmlLink === 'string' ? data.htmlLink : undefined,
    };
  } catch (err) {
    logger.error('Google Calendar event sync threw', err);
    return { synced: false, reason: 'google-api-error' };
  }
}

/**
 * Delete a reminder's Google Calendar event (best-effort, never throws).
 * 404/410 are treated as success — the event is already gone.
 */
export async function deleteReminderCalendarEvent(
  userId: string,
  eventId: string | null
): Promise<void> {
  if (!eventId) return;

  const connection = await getCalendarConnection(userId);
  if (!connection) return;

  const client = await getValidAccessToken(connection);
  if (!client) return;

  const calendarId = connection.calendar_id || 'primary';
  try {
    const res = await fetch(
      `${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${client.accessToken}` },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      logger.error('Failed to delete calendar event', { status: res.status, eventId });
    }
  } catch (err) {
    logger.error('Failed to delete calendar event (non-fatal)', err);
  }
}

/**
 * Disconnect a member's Google Calendar.
 *
 * Before the tokens are lost, best-effort: delete calendar events for any
 * active reminders, then revoke the Google token, then remove the connection
 * row. Afterwards no new events can be created (no connection), while the
 * in-app reminder (CC-08) continues to fire — calendar is additive.
 */
export async function disconnectCalendar(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  // Clean up existing events while we still hold the tokens.
  const { data: activeReminders, error: remindersError } = await supabase
    .from('user_reminders')
    .select('calendar_event_id')
    .eq('user_id', userId)
    .eq('is_sent', false)
    .not('calendar_event_id', 'is', null);

  if (remindersError) {
    logger.error('Failed to list active reminder events for disconnect', remindersError);
  } else {
    for (const reminder of activeReminders || []) {
      await deleteReminderCalendarEvent(userId, reminder.calendar_event_id);
    }
  }

  // Clear the stale event pointers so a future reconnect never updates a
  // deleted event.
  await supabase
    .from('user_reminders')
    .update({ calendar_event_id: null, calendar_event_link: null })
    .eq('user_id', userId)
    .eq('is_sent', false);

  // Revoke the token, then drop the connection row.
  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('access_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (connection?.access_token) {
    await revokeGoogleToken(connection.access_token);
  }

  const { error } = await supabase.from('calendar_connections').delete().eq('user_id', userId);

  if (error) {
    logger.error('Failed to disconnect calendar', error);
    return { success: false, error: 'Failed to disconnect calendar' };
  }

  logger.info(`Disconnected Google Calendar for user ${userId}`);
  return { success: true };
}
