-- CC-15 · Real-calendar reminders (Google Calendar)
--
-- Two schema extensions:
--   1) user_reminders gains the cadence the member chose (so the Google
--      Calendar event can recur for it) plus pointers to the created
--      Google Calendar event (calendar_event_id / calendar_event_link)
--      so reminders can be created/updated/cleaned up.
--   2) A new calendar_connections table stores the member's Google
--      Calendar OAuth token (events scope ONLY — the app never reads
--      contacts/mail and never gains login access).
--
-- Security: calendar_connections holds access + refresh tokens, so RLS is
-- enabled with NO owner SELECT policy — the anon/authenticated client can
-- never read the row directly. All reads/writes go through server API routes
-- using the service-role client. Admins may read connections for support.

-- 1) user_reminders schema extension --------------------------------

ALTER TABLE public.user_reminders
  ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'weekly';

-- Keep the cadence constrained (mirrors REMINDER_CADENCES in
-- lib/reminders/reminder-engine.ts). Guard with a DO block so re-running
-- this migration is safe if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_reminders_cadence_check'
  ) THEN
    ALTER TABLE public.user_reminders
      ADD CONSTRAINT user_reminders_cadence_check
      CHECK (cadence IN ('daily', 'weekly', 'monthly'));
  END IF;
END $$;

-- Where the Google Calendar event for a reminder lives. Used for
-- create/update (upsert the event) and cleanup on cancel/disconnect.
ALTER TABLE public.user_reminders
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

ALTER TABLE public.user_reminders
  ADD COLUMN IF NOT EXISTS calendar_event_link TEXT;

-- 2) calendar_connections -------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  -- The connected Google account email (primary calendar id). Nullable when
  -- the calendar profile fetch fails during the OAuth callback.
  google_email TEXT,
  access_token TEXT NOT NULL,
  -- Nullable: Google omits refresh_token on re-consent; we preserve the
  -- stored one when that happens (see saveCalendarConnection).
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_connections_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON public.calendar_connections(user_id);

-- RLS locked down — tokens must never be readable by the client.
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Admin can read all connections (matches the user_reminders admin pattern).
CREATE POLICY "Admin can read calendar connections"
  ON public.calendar_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );
