import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { env } from '@/lib/config/env';
import { refreshToken } from './oauth';

interface CalendarConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string;
}

async function withFreshToken(conn: CalendarConnection): Promise<{ accessToken: string; conn: CalendarConnection }> {
  const supabase = createServiceRoleClient();
  const now = Date.now();

  if (new Date(conn.expires_at).getTime() - now > 5 * 60 * 1000) {
    // Token valid for more than 5 minutes — use as-is
    return { accessToken: conn.access_token, conn };
  }

  // Refresh the token
  const refreshed = await refreshToken(conn.refresh_token);
  const { data: updated, error } = await supabase
    .from('calendar_connections')
    .update({ access_token: refreshed.access_token, expires_at: refreshed.expires_at, updated_at: new Date().toISOString() })
    .eq('id', conn.id)
    .select()
    .single();

  if (error || !updated) {
    throw new Error('Failed to refresh calendar token');
  }

  return { accessToken: updated.access_token as string, conn: updated as CalendarConnection };
}

async function callCalendarApi(accessToken: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `https://www.googleapis.com/calendar/v3/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }

  return res.json();
}

export interface CalendarReminderParams {
  userId: string;
  topic: string;
  remindAt: Date;
  cadence: 'daily' | 'weekly' | 'monthly';
}

export async function createCalendarReminderEvent(params: CalendarReminderParams): Promise<{ eventId: string | null; error?: string }> {
  const supabase = createServiceRoleClient();

  const { data: conn, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', params.userId)
    .single();

  if (error || !conn) {
    // No calendar connection — in-app reminder still fires (CC-08 intact)
    return { eventId: null };
  }

  const calendarConn = conn as CalendarConnection;

  try {
    const { accessToken } = await withFreshToken(calendarConn);
    const calendarId = (calendarConn.calendar_id as string) || 'primary';

    const event: Record<string, unknown> = {
      summary: params.topic,
      description: `Coach Cass AI reminder: ${params.topic}`,
      start: { dateTime: params.remindAt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: new Date(params.remindAt.getTime() + 15 * 60 * 1000).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    };

    // Set recurrence for cadence
    if (params.cadence === 'daily') {
      event['recurrence'] = ['RRULE:FREQ=DAILY;INTERVAL=1'];
    } else if (params.cadence === 'weekly') {
      event['recurrence'] = ['RRULE:FREQ=WEEKLY;INTERVAL=1'];
    } else if (params.cadence === 'monthly') {
      event['recurrence'] = ['RRULE:FREQ=MONTHLY;INTERVAL=1'];
    }

    const created = await callCalendarApi(accessToken, 'POST', `calendars/${encodeURIComponent(calendarId)}/events`, event) as { id: string };

    // Store the event ID on the connection for future updates/deletions
    const { error: updateErr } = await supabase
      .from('calendar_connections')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', calendarConn.id);

    if (updateErr) {
      console.error('Failed to update calendar connection after event creation', updateErr);
    }

    return { eventId: created.id };
  } catch (err) {
    console.error('Failed to create calendar event', err);
    // Non-fatal: calendar failure does not block the in-app reminder
    return { eventId: null };
  }
}

export async function deleteCalendarReminderEvent(userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const { data: conn, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !conn) {
    return { success: true }; // Nothing to delete
  }

  const calendarConn = conn as CalendarConnection;

  try {
    const { accessToken } = await withFreshToken(calendarConn);
    const calendarId = (calendarConn.calendar_id as string) || 'primary';

    // Find events with our reminder description pattern and delete them
    const events = await callCalendarApi(accessToken, 'GET', `calendars/${encodeURIComponent(calendarId)}/events?q=Coach+Cass+AI+reminder&maxResults=50`) as { items?: Array<{ id: string }> };

    if (events.items) {
      for (const evt of events.items) {
        await callCalendarApi(accessToken, 'DELETE', `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(evt.id)}`);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to delete calendar events', err);
    return { success: false, error: 'Failed to remove calendar events' };
  }
}
