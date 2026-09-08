-- Persistent conversation memory: AI-generated summaries of past conversations
-- These summaries are injected into the member context so Coach Cass remembers
-- previous discussions even after the user returns on a different day/session.

CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_topics TEXT[] NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_id ON public.conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_generated_at ON public.conversation_summaries(generated_at DESC);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Users can read their own summaries
CREATE POLICY "Users can read own summaries"
  ON public.conversation_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (api routes) bypasses RLS
CREATE POLICY "Service role can insert summaries"
  ON public.conversation_summaries FOR INSERT
  WITH CHECK (true);
