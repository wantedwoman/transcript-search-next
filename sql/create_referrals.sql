-- Referrals table: tracks who referred whom and commission status
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON public.referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own referrals (where they are the referrer)
CREATE POLICY "Users can read own referrals"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Policy: Users can insert referrals (system inserts on signup)
CREATE POLICY "Users can insert referrals"
  ON public.referrals
  FOR INSERT
  WITH CHECK (true);

-- Policy: Admin can read/update all referrals
CREATE POLICY "Admin can manage all referrals"
  ON public.referrals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );