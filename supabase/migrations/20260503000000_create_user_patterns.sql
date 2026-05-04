-- User patterns: recurring themes, emotional trends, and growth patterns surfaced by Suzy
CREATE TABLE IF NOT EXISTS public.user_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  topics_observed TEXT[] NOT NULL DEFAULT '{}',
  tone_trend TEXT NOT NULL DEFAULT '',
  repeat_questions TEXT[] NOT NULL DEFAULT '{}',
  suggested_focus TEXT NOT NULL DEFAULT '',
  heartbeat_link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_patterns_user_id ON public.user_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_generated_at ON public.user_patterns(generated_at);
CREATE INDEX IF NOT EXISTS idx_user_patterns_unread ON public.user_patterns(user_id) WHERE is_read = false AND is_dismissed = false;

-- RLS
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

-- Users can read their own patterns
CREATE POLICY "Users can read own patterns"
  ON public.user_patterns FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own patterns (read/dismiss)
CREATE POLICY "Users can update own patterns"
  ON public.user_patterns FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin can read all patterns
CREATE POLICY "Admin can read all patterns"
  ON public.user_patterns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );