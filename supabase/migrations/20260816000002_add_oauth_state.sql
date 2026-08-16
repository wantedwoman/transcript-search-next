-- CC-15: OAuth state table for CSRF protection during calendar consent flow

CREATE TABLE IF NOT EXISTS public.oauth_state (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google_calendar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expire states older than 10 minutes (run via cron or prune on each callback)
CREATE INDEX IF NOT EXISTS idx_oauth_state_created ON public.oauth_state(created_at);
