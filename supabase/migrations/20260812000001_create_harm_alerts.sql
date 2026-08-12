-- CC-09: Harm alerts table — created when the chat route detects self-harm,
-- suicide, or violence language. Supports team notification + admin dashboard.

CREATE TABLE IF NOT EXISTS harm_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_snippet TEXT NOT NULL,
  matched_pattern TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'critical')),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index used by the admin harm-alerts view (unacknowledged first, newest first)
CREATE INDEX IF NOT EXISTS idx_harm_alerts_acknowledged_created_at
  ON harm_alerts (acknowledged, created_at DESC);

ALTER TABLE harm_alerts ENABLE ROW LEVEL SECURITY;

-- Service role full access. (service_role bypasses RLS in Supabase anyway,
-- this documents the intent explicitly.)
CREATE POLICY "Service role full access on harm_alerts" ON harm_alerts
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Admins can read harm alerts.
-- NOTE: user_profiles has no `role` column (admin is email-based, see
-- sql/create_user_profiles.sql), so this uses the same email admin check
-- instead of the UP.role = 'admin' reference.
CREATE POLICY "Admins can read harm_alerts" ON harm_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );
