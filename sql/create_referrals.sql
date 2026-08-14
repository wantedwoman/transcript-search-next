-- Referrals table: tracks who referred whom and commission status.
-- CC-04 lifecycle: pending → released (hold period passed + payment confirmed)
--                  → paid (payout threshold reached or owner action).
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'paid')),
  credit_amount NUMERIC(10,2),
  flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON public.referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);
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

-- ----------------------------------------------------------------------------
-- Referral credit ledger (CC-04): every value-creating transition in the
-- referral lifecycle writes a row here so in-app commission credit has an
-- audit trail. kind='release' → credit earned; kind='paid' → credit applied.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'release' CHECK (kind IN ('release', 'paid', 'adjustment')),
  status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'applied')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_credits_referrer ON public.referral_credits(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_referral ON public.referral_credits(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_created_at ON public.referral_credits(created_at);

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own credit ledger
CREATE POLICY "Users can read own credits"
  ON public.referral_credits
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Policy: Admin can read/write all credit ledger rows
CREATE POLICY "Admin can manage credits"
  ON public.referral_credits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );
