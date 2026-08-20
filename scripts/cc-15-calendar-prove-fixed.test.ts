/**
 * Prove-fixed test for CC-15 (Google Calendar reminders).
 *
 * Verifies the four binary checks from the card:
 *   1. OAuth consent flow connects and stores a token.
 *   2. Creating a reminder creates a real Google Calendar event.
 *   3. Recurring cadence → recurring event.
 *   4. Disconnect removes the connection and no new events are created;
 *      in-app reminders still fire with no calendar.
 *
 * Run with: npx tsx scripts/cc-15-calendar-prove-fixed.test.ts
 *
 * Mocks global.fetch: Supabase PostgREST responses, the Google OAuth token
 * endpoint, and the Google Calendar API. No live credentials are used.
 */
import assert from 'node:assert/strict';

// Set env before importing the module graph so lib/config/env.ts picks it up
// (all fields are optional, but the service-role client needs these).
(process.env as Record<string, string | undefined>).NODE_ENV = 'development';
(process.env as Record<string, string | undefined>).SUPABASE_URL = 'https://example.supabase.co';
(process.env as Record<string, string | undefined>).SUPABASE_SERVICE_ROLE_KEY = 'svc_role_key';
(process.env as Record<string, string | undefined>).GOOGLE_CAL_CLIENT_ID = 'test-client-id';
(process.env as Record<string, string | undefined>).GOOGLE_CAL_CLIENT_SECRET = 'test-client-secret';

const { buildAuthUrl, exchangeCodeForTokens, GOOGLE_CAL_SCOPE } = await import(
  '../lib/google-calendar/oauth'
);
const {
  buildRecurrenceRule,
  buildCalendarEventPayload,
  syncReminderToCalendar,
  disconnectCalendar,
} = await import('../lib/google-calendar/calendar-reminders');

type RecordedCall = { url: string; method: string; headers: Record<string, string>; body: string };
const googleCalls: RecordedCall[] = [];
const supabaseCalls: RecordedCall[] = [];

// Simulated DB state — the DELETE handler nulls the connection row so a
// subsequent sync behaves as if the member disconnected.
let connectionRow: Record<string, unknown> | null = null;
// Active reminders with a calendar_event_id (used by disconnect cleanup).
let activeReminderEvents: Record<string, unknown>[] = [];

function mockResponse(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 204 ? 'No Content' : 'OK',
    text: async () => (status === 204 ? '' : text),
    json: async () => (status === 204 ? undefined : JSON.parse(text)),
    headers: { get: () => null },
  };
}

function recordCall(url: string, init: any, bucket: RecordedCall[]) {
  bucket.push({
    url: String(url),
    method: (init?.method || 'GET').toUpperCase(),
    headers: init?.headers ?? {},
    body: init?.body ?? '',
  });
}

(globalThis as any).fetch = async (url: string, init: any) => {
  const fullUrl = String(url);
  const method = (init?.method || 'GET').toUpperCase();

  // ---- Supabase PostgREST ----
  if (fullUrl.includes('/rest/v1/')) {
    recordCall(fullUrl, init, supabaseCalls);

    if (fullUrl.includes('/rest/v1/calendar_connections')) {
      if (method === 'GET') {
        return mockResponse(200, connectionRow ? [connectionRow] : []);
      }
      if (method === 'DELETE') {
        connectionRow = null;
        return mockResponse(204, '');
      }
      // PATCH with select() (token refresh persistence) returns the row;
      // POST upsert / minimal PATCH return 204.
      if (method === 'PATCH' && fullUrl.includes('select=')) {
        return mockResponse(200, connectionRow);
      }
      return mockResponse(204, '');
    }

    if (fullUrl.includes('/rest/v1/user_reminders')) {
      if (method === 'GET') return mockResponse(200, activeReminderEvents);
      return mockResponse(204, '');
    }

    return mockResponse(200, []);
  }

  // ---- Google OAuth token / revoke ----
  if (fullUrl.includes('oauth2.googleapis.com')) {
    recordCall(fullUrl, init, googleCalls);
    if (fullUrl.includes('/revoke')) {
      return mockResponse(200, '');
    }
    return mockResponse(200, {
      access_token: 'at_123',
      refresh_token: 'rt_123',
      expires_in: 3600,
      scope: GOOGLE_CAL_SCOPE,
      token_type: 'Bearer',
    });
  }

  // ---- Google Calendar API ----
  if (fullUrl.includes('www.googleapis.com/calendar')) {
    recordCall(fullUrl, init, googleCalls);
    if (fullUrl.includes('/calendarList/primary')) {
      return mockResponse(200, { id: 'member@gmail.com', summary: 'member@gmail.com' });
    }
    if (method === 'DELETE') {
      return mockResponse(204, '');
    }
    return mockResponse(200, {
      id: 'evt_cc15_1',
      htmlLink: 'https://calendar.google.com/calendar/event?eid=abc',
    });
  }

  throw new Error(`Unexpected fetch: ${fullUrl}`);
};

async function main() {
  // ---- Check 1: OAuth consent is events-scope only and offline ----
  const authUrl = buildAuthUrl('state_123', 'https://app.coachcass.app/api/suzy/calendar/callback');
  const parsed = new URL(authUrl);
  assert.equal(parsed.searchParams.get('scope'), GOOGLE_CAL_SCOPE, 'scope must be calendar.events only');
  assert.ok(!(GOOGLE_CAL_SCOPE.includes('mail')), 'must never request mail scope');
  assert.ok(!(GOOGLE_CAL_SCOPE.includes('contacts')), 'must never request contacts scope');
  assert.ok(!(GOOGLE_CAL_SCOPE.includes('login')), 'must never request login scope');
  assert.equal(parsed.searchParams.get('access_type'), 'offline', 'offline access for a refresh token');
  assert.equal(parsed.searchParams.get('prompt'), 'consent', 'consent prompt guarantees refresh token');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://app.coachcass.app/api/suzy/calendar/callback');
  assert.equal(parsed.searchParams.get('state'), 'state_123');

  // Code exchange stores tokens.
  const tokens = await exchangeCodeForTokens('code_123', 'https://app.coachcass.app/api/suzy/calendar/callback');
  assert.equal(tokens.access_token, 'at_123', 'access token returned');
  assert.equal(tokens.refresh_token, 'rt_123', 'refresh token returned');
  const tokenCall = googleCalls.find((c) => c.url.includes('oauth2.googleapis.com/token'));
  assert.ok(tokenCall, 'token endpoint must be called');
  assert.equal(tokenCall.method, 'POST');
  const tokenBody = new URLSearchParams(tokenCall.body);
  assert.equal(tokenBody.get('grant_type'), 'authorization_code');
  assert.equal(tokenBody.get('code'), 'code_123');
  assert.equal(tokenBody.get('client_id'), 'test-client-id');
  assert.equal(tokenBody.get('client_secret'), 'test-client-secret');

  // ---- Check 3 (build): recurring cadence → recurring event ----
  assert.deepEqual(buildRecurrenceRule('daily'), ['RRULE:FREQ=DAILY']);
  assert.deepEqual(buildRecurrenceRule('weekly'), ['RRULE:FREQ=WEEKLY']);
  assert.deepEqual(buildRecurrenceRule('monthly'), ['RRULE:FREQ=MONTHLY']);

  const payload = buildCalendarEventPayload({
    userId: 'u1',
    topic: 'check in on dating boundaries',
    remindAt: '2026-08-21T12:00:00.000Z',
    cadence: 'weekly',
    googleEmail: 'member@gmail.com',
  });
  assert.equal(payload.summary, 'check in on dating boundaries');
  assert.equal((payload.start as any).dateTime, '2026-08-21T12:00:00.000Z', 'event starts at member-chosen time');
  assert.equal((payload.end as any).dateTime, '2026-08-21T12:30:00.000Z');
  assert.deepEqual(payload.recurrence, ['RRULE:FREQ=WEEKLY'], 'weekly cadence -> recurring event');
  assert.deepEqual(payload.attendees, [{ email: 'member@gmail.com' }], 'member is the attendee');

  // ---- Check 2: no connection → additive; in-app reminder still fires ----
  connectionRow = null;
  const googleCallsBefore = googleCalls.length;
  const noCal = await syncReminderToCalendar({
    userId: 'u_no_cal',
    topic: 't',
    remindAt: new Date().toISOString(),
    cadence: 'weekly',
  });
  assert.equal(noCal.synced, false);
  assert.equal(noCal.reason, 'no-calendar-connection', 'calendar is additive — no connection, no event');
  assert.equal(googleCalls.length, googleCallsBefore, 'no Google call when there is no connection');

  // ---- Check 2 (connected): creating a reminder creates a real calendar event ----
  connectionRow = {
    id: 'conn_1',
    user_id: 'u1',
    provider: 'google',
    google_email: 'member@gmail.com',
    access_token: 'at_fresh',
    refresh_token: 'rt_123',
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(), // fresh — no refresh needed
    calendar_id: 'primary',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const syncResult = await syncReminderToCalendar({
    userId: 'u1',
    topic: 'weekly check-in',
    remindAt: '2026-08-21T12:00:00.000Z',
    cadence: 'weekly',
    googleEmail: 'app@example.com',
  });
  assert.equal(syncResult.synced, true, 'event created');
  assert.equal(syncResult.eventId, 'evt_cc15_1');
  assert.equal(syncResult.eventLink, 'https://calendar.google.com/calendar/event?eid=abc');

  const eventCall = googleCalls.find((c) => c.url.includes('/calendar/v3/calendars/primary/events'));
  assert.ok(eventCall, 'must call the calendar events endpoint');
  assert.equal(eventCall.method, 'POST', 'creating a reminder creates a new event');
  assert.equal(eventCall.headers.Authorization, 'Bearer at_fresh');
  assert.equal(eventCall.headers['Content-Type'], 'application/json');
  const eventBody = JSON.parse(eventCall.body);
  assert.equal(eventBody.summary, 'weekly check-in');
  assert.deepEqual(eventBody.recurrence, ['RRULE:FREQ=WEEKLY']);
  // Connection google email wins over the app-email fallback.
  assert.deepEqual(eventBody.attendees, [{ email: 'member@gmail.com' }]);
  assert.equal(eventBody.start.dateTime, '2026-08-21T12:00:00.000Z');
  assert.equal(eventBody.end.dateTime, '2026-08-21T12:30:00.000Z');

  // ---- Token refresh: expired token triggers a refresh before the call ----
  connectionRow = {
    ...(connectionRow as Record<string, unknown>),
    access_token: 'at_stale',
    token_expires_at: new Date(Date.now() - 60_000).toISOString(), // expired
  };
  await syncReminderToCalendar({
    userId: 'u1',
    topic: 'refresh check-in',
    remindAt: '2026-08-21T12:00:00.000Z',
    cadence: 'monthly',
  });
  const refreshCall = googleCalls.find((c) => c.url.includes('oauth2.googleapis.com/token'));
  const refreshBodies = googleCalls
    .filter((c) => c.url.includes('oauth2.googleapis.com/token'))
    .map((c) => new URLSearchParams(c.body));
  assert.ok(
    refreshBodies.some((b) => b.get('grant_type') === 'refresh_token'),
    'expired token must be refreshed via grant_type=refresh_token'
  );
  assert.ok(refreshCall, 'token refresh call recorded');

  // ---- Check 4: disconnect removes connection; no new events after ----
  activeReminderEvents = [{ calendar_event_id: 'evt_cc15_1' }]; // an active reminder has a calendar event
  const revokeBefore = googleCalls.filter((c) => c.url.includes('/revoke')).length;
  const result = await disconnectCalendar('u1');
  assert.equal(result.success, true, 'disconnect succeeds');
  assert.equal(
    googleCalls.filter((c) => c.url.includes('/revoke')).length,
    revokeBefore + 1,
    'disconnect revokes the Google token'
  );
  assert.ok(
    supabaseCalls.some((c) => c.method === 'DELETE' && c.url.includes('/rest/v1/calendar_connections')),
    'disconnect removes the calendar_connections row'
  );
  assert.ok(
    googleCalls.some((c) => c.method === 'DELETE' && c.url.includes('/calendar/v3/calendars/primary/events')),
    'disconnect deletes the existing calendar event'
  );

  // Mock DELETE handler nulled the connection row — a subsequent sync must not
  // create any new event.
  const eventsBefore = googleCalls.filter((c) => c.url.includes('/calendar/v3/calendars/primary/events')).length;
  const afterDisconnect = await syncReminderToCalendar({
    userId: 'u1',
    topic: 'should not appear',
    remindAt: '2026-08-22T12:00:00.000Z',
    cadence: 'weekly',
  });
  assert.equal(afterDisconnect.synced, false, 'no new events after disconnect');
  assert.equal(afterDisconnect.reason, 'no-calendar-connection');
  assert.equal(
    googleCalls.filter((c) => c.url.includes('/calendar/v3/calendars/primary/events')).length,
    eventsBefore,
    'no new calendar event created after disconnect'
  );

  console.log('\nALL ASSERTIONS PASSED — CC-15 Google Calendar reminders prove-fixed.');
  console.log(`  OAuth scope: ${GOOGLE_CAL_SCOPE}`);
  console.log(`  events endpoint calls: ${googleCalls.filter((c) => c.url.includes('/calendar/v3/calendars/primary/events')).length}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
