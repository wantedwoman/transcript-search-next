-- CC-04 · Affiliate/referral lifecycle state machine + credit ledger.
--
-- Extends the referrals table (created in
-- 20260809140000_consolidate_loose_schema.sql, sourced from
-- sql/create_referrals.sql) with the columns the lifecycle needs, and creates
-- the referral_credits ledger that records every credit event.
--
-- Idempotent — safe to run against an environment that already applied the
-- loose SQL or this migration.

-- Referral state machine columns.
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(10,2);
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);

-- Credit ledger: every value-creating transition (release → earned,
-- payout → applied) gets a row.
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

DROP POLICY IF EXISTS "Users can read own credits" ON public.referral_credits;
CREATE POLICY "Users can read own credits"
  ON public.referral_credits
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

DROP POLICY IF EXISTS "Admin can manage credits" ON public.referral_credits;
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
