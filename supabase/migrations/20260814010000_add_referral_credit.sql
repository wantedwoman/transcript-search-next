-- CC-14 F-1: surface referral credit in the admin view.
--
-- Aligns column name/meaning with the CC-04 affiliate lifecycle contract:
-- `credit_amount` is a NUMERIC amount in USD, nullable so existing referrals
-- with no recorded credit still load.
--
-- Idempotent: safe to run even after CC-04 has already added this column
-- (ADD COLUMN IF NOT EXISTS is a no-op when the column exists).
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS credit_amount NUMERIC;
