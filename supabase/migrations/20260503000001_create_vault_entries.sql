-- Private Vault: saved Suzy responses a user wants to keep and revisit
CREATE TABLE IF NOT EXISTS public.vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  user_tag TEXT NOT NULL DEFAULT '',
  heartbeat_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_id ON public.vault_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_entries_created_at ON public.vault_entries(created_at DESC);

-- RLS
ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

-- Users can insert their own vault entries
CREATE POLICY "Users can insert own vault entries"
  ON public.vault_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own vault entries
CREATE POLICY "Users can read own vault entries"
  ON public.vault_entries FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own vault entries
CREATE POLICY "Users can delete own vault entries"
  ON public.vault_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Admin can read all vault entries
CREATE POLICY "Admin can read all vault entries"
  ON public.vault_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );