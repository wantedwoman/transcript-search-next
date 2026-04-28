-- User onboarding table: stores profile details collected after signup
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age INTEGER,
  profession TEXT,
  income_range TEXT CHECK (income_range IN ('$50k-75k', '$75k-100k', '$100k-150k', '$150k+')),
  hobbies TEXT,
  love_struggles TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON public.user_onboarding(user_id);

-- Enable RLS
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own onboarding data
CREATE POLICY "Users can read own onboarding"
  ON public.user_onboarding
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own onboarding data
CREATE POLICY "Users can insert own onboarding"
  ON public.user_onboarding
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own onboarding data
CREATE POLICY "Users can update own onboarding"
  ON public.user_onboarding
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Admin can read all onboarding data
CREATE POLICY "Admin can read all onboarding"
  ON public.user_onboarding
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.update_user_onboarding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_onboarding_update ON public.user_onboarding;
CREATE TRIGGER on_user_onboarding_update
  BEFORE UPDATE ON public.user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_onboarding_timestamp();