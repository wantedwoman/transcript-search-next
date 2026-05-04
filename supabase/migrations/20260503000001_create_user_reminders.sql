-- Growth Reminders: periodic check-ins from Suzy based on past conversation topics
CREATE TABLE IF NOT EXISTS public.user_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_reminders_user_id ON public.user_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reminders_due ON public.user_reminders(remind_at) WHERE is_sent = false;
CREATE INDEX IF NOT EXISTS idx_user_reminders_active ON public.user_reminders(user_id) WHERE is_sent = false;

-- RLS
ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

-- Users can read their own reminders
CREATE POLICY "Users can read own reminders"
  ON public.user_reminders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own reminders
CREATE POLICY "Users can insert own reminders"
  ON public.user_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reminders (cancel)
CREATE POLICY "Users can update own reminders"
  ON public.user_reminders FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own reminders
CREATE POLICY "Users can delete own reminders"
  ON public.user_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Admin can read all reminders
CREATE POLICY "Admin can read all reminders"
  ON public.user_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );