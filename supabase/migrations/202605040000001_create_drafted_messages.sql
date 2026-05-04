-- Drafted messages: Love Letter / Text Drafting Engine
CREATE TABLE IF NOT EXISTS public.drafted_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  drafted_text TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'Neutral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drafted_messages_user_id ON public.drafted_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_drafted_messages_created_at ON public.drafted_messages(created_at DESC);

-- RLS
ALTER TABLE public.drafted_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own drafts
CREATE POLICY "Users can read own drafted messages"
  ON public.drafted_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own drafts
CREATE POLICY "Users can insert own drafted messages"
  ON public.drafted_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own drafts
CREATE POLICY "Users can update own drafted messages"
  ON public.drafted_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own drafts
CREATE POLICY "Users can delete own drafted messages"
  ON public.drafted_messages FOR DELETE
  USING (auth.uid() = user_id);