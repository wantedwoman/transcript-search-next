-- Referral codes table: one code per user for sharing
CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast code lookups (the main query path)
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own referral code
CREATE POLICY "Users can read own referral code"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own referral code
CREATE POLICY "Users can insert own referral code"
  ON public.referral_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Anyone can look up a code by value (for signup referral tracking)
CREATE POLICY "Anyone can look up referral code by value"
  ON public.referral_codes
  FOR SELECT
  USING (true);

-- Policy: Admin can read all referral codes
CREATE POLICY "Admin can read all referral codes"
  ON public.referral_codes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );