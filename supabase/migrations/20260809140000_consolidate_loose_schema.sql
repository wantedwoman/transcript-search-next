-- ============================================================================
-- CC-01: Consolidate loose schema into the live DB
-- ============================================================================
-- This migration is a consolidation of the previously-loose SQL files in
-- sql/*.sql (create_user_onboarding.sql, create_user_profiles.sql,
-- create_referral_codes.sql, create_referrals.sql,
-- create_conversations_and_insights.sql, create_webhook_events.sql), plus one
-- additive column (conversations.title) needed to match application code in
-- app/api/suzy/chat/route.ts.
--
-- Every statement is written to be idempotent (CREATE TABLE IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DROP POLICY IF EXISTS
-- followed by CREATE POLICY, DROP TRIGGER IF EXISTS followed by CREATE
-- TRIGGER, CREATE OR REPLACE FUNCTION). It is safe to run more than once and
-- does not drop or modify any existing data.
--
-- LIVE DB STATUS (verified 2026-08-11 via live REST/OpenAPI introspection of
-- the project named in this worktree's .env.local): every table this
-- migration creates ALREADY EXISTS live with matching columns EXCEPT
-- public.conversations.title, which is confirmed missing live (PostgREST
-- error 42703 "column conversations.title does not exist" when queried).
-- RLS + policy behavior on user_onboarding was verified live end-to-end
-- (service-role insert, same-user read allowed, cross-user read rejected
-- returning zero rows) using two ephemeral test auth users created and
-- deleted via the GoTrue admin API — see CC-01 card verification notes.
--
-- The `ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS title TEXT`
-- statement below is this migration's one outstanding live effect. It could
-- NOT be executed against the live DB from this worktree: this repo's
-- .env.local only provides PostgREST-level credentials (SUPABASE_URL,
-- ANON_KEY, SERVICE_ROLE_KEY), which allow row-level REST access but cannot
-- run DDL. Running it requires either the project's direct Postgres password
-- (for `psql` / `supabase link --password` / `supabase db push`) or a
-- Supabase Management API personal access token (for `supabase login` +
-- `supabase link`), neither of which is present in this worktree. Applying
-- this migration (e.g. via the Supabase SQL editor, or CLI once one of those
-- credentials is supplied) is a remaining manual step.
--
-- --------------------------------------------------------------------------
-- MANUAL ROLLBACK (if this migration is ever applied and needs to be undone)
-- --------------------------------------------------------------------------
-- This migration is purely additive (new tables + one new nullable column),
-- so rollback only means removing what it added. Nothing pre-existing is
-- touched. To roll back, run, in this order (children before parents):
--
--   ALTER TABLE public.conversations DROP COLUMN IF EXISTS title;
--
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--   DROP TRIGGER IF EXISTS on_user_onboarding_update ON public.user_onboarding;
--   DROP FUNCTION IF EXISTS public.handle_new_user();
--   DROP FUNCTION IF EXISTS public.update_last_active();
--   DROP FUNCTION IF EXISTS public.update_user_onboarding_timestamp();
--
--   DROP TABLE IF EXISTS public.carousel_content;
--   DROP TABLE IF EXISTS public.aggregate_insights;
--   DROP TABLE IF EXISTS public.user_insights;
--   DROP TABLE IF EXISTS public.conversation_messages;
--   DROP TABLE IF EXISTS public.conversations;  -- CAUTION: only if conversations
--                                                 -- did not already exist prior
--                                                 -- to this migration; check
--                                                 -- first, see note below.
--   DROP TABLE IF EXISTS public.webhook_events;
--   DROP TABLE IF EXISTS public.referrals;
--   DROP TABLE IF EXISTS public.referral_codes;
--   DROP TABLE IF EXISTS public.user_onboarding;
--   DROP TABLE IF EXISTS public.user_profiles;
--
-- NOTE: public.conversations already exists on the live DB today (per CC-01
-- card notes) with columns id/user_id/created_at/updated_at — this migration
-- only ADDS the missing `title` column to it via CREATE TABLE IF NOT EXISTS
-- (no-op if present) + ADD COLUMN IF NOT EXISTS. Do not DROP TABLE
-- conversations during rollback unless you are certain it did not exist
-- before this migration ran.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. user_profiles  (source: sql/create_user_profiles.sql)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can read all profiles" ON public.user_profiles;
CREATE POLICY "Admin can read all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can update profiles" ON public.user_profiles;
CREATE POLICY "Admin can update profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can delete profiles" ON public.user_profiles;
CREATE POLICY "Admin can delete profiles"
  ON public.user_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Service role bypasses RLS automatically (webhook handler / admin APIs).

-- Auto-create user_profiles row when a user is provisioned into auth.users.
-- NOTE: this supports the existing invite/purchase-triggered provisioning
-- flow in lib/auth/auto-provision.ts (provisionUser() calls
-- supabase.auth.admin.createUser(), which fires this trigger, then the app
-- code upserts as a belt-and-suspenders safety net). There is no public
-- self-signup form in this codebase that lets an anonymous visitor create
-- their own auth.users row — accounts are created by admin/webhook flows
-- only, so this trigger does not open a self-signup path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, status)
  VALUES (NEW.id, NEW.email, 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Defined for parity with sql/create_user_profiles.sql. Not attached to a
-- trigger — Supabase auth does not expose a reliable post-login trigger;
-- last_active is updated from application code instead (see source file
-- comment). Kept here only so the function exists if/when a caller needs it.
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_active = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 2. user_onboarding  (source: sql/create_user_onboarding.sql)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON public.user_onboarding(user_id);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can read own onboarding"
  ON public.user_onboarding
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can insert own onboarding"
  ON public.user_onboarding
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can update own onboarding"
  ON public.user_onboarding
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can read all onboarding" ON public.user_onboarding;
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


-- ----------------------------------------------------------------------------
-- 3. referral_codes  (source: sql/create_referral_codes.sql)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own referral code" ON public.referral_codes;
CREATE POLICY "Users can read own referral code"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own referral code" ON public.referral_codes;
CREATE POLICY "Users can insert own referral code"
  ON public.referral_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Anyone can look up a code by value, needed so a referral code can be
-- validated during onboarding before the looking-up user is necessarily
-- the code's owner. Matches sql/create_referral_codes.sql exactly.
DROP POLICY IF EXISTS "Anyone can look up referral code by value" ON public.referral_codes;
CREATE POLICY "Anyone can look up referral code by value"
  ON public.referral_codes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin can read all referral codes" ON public.referral_codes;
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


-- ----------------------------------------------------------------------------
-- 4. referrals  (source: sql/create_referrals.sql)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON public.referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own referrals" ON public.referrals;
CREATE POLICY "Users can read own referrals"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

DROP POLICY IF EXISTS "Users can insert referrals" ON public.referrals;
CREATE POLICY "Users can insert referrals"
  ON public.referrals
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can manage all referrals" ON public.referrals;
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
-- 5. conversations + insights family
--    (source: sql/create_conversations_and_insights.sql)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CC-01: conversations.title is selected by app/api/suzy/chat/route.ts
-- (.select('id, title, created_at')) but no column existed. Additive,
-- nullable — does not affect any existing row.
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);

CREATE TABLE IF NOT EXISTS public.user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  topics TEXT[] NOT NULL DEFAULT '{}',
  tone TEXT NOT NULL DEFAULT 'neutral',
  key_questions TEXT[] NOT NULL DEFAULT '{}',
  coaching_suggestions TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON public.user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_date ON public.user_insights(date);

CREATE TABLE IF NOT EXISTS public.aggregate_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  trending_topics TEXT[] NOT NULL DEFAULT '{}',
  common_questions TEXT[] NOT NULL DEFAULT '{}',
  recurring_pain_points TEXT[] NOT NULL DEFAULT '{}',
  content_hooks TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aggregate_insights_date ON public.aggregate_insights(date);

CREATE TABLE IF NOT EXISTS public.carousel_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slides JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  source_insight_id UUID REFERENCES public.aggregate_insights(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_carousel_content_status ON public.carousel_content(status);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregate_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own conversations" ON public.conversations;
CREATE POLICY "Users can read own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
CREATE POLICY "Users can insert own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own messages" ON public.conversation_messages;
CREATE POLICY "Users can read own messages"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own messages" ON public.conversation_messages;
CREATE POLICY "Users can insert own messages"
  ON public.conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read own insights" ON public.user_insights;
CREATE POLICY "Users can read own insights"
  ON public.user_insights FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can read all conversations" ON public.conversations;
CREATE POLICY "Admin can read all conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can read all messages" ON public.conversation_messages;
CREATE POLICY "Admin can read all messages"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can read all insights" ON public.user_insights;
CREATE POLICY "Admin can read all insights"
  ON public.user_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- aggregate_insights / carousel_content are cross-user aggregate/admin
-- content (not per-user private data) — public SELECT + admin-only write,
-- matching sql/create_conversations_and_insights.sql exactly.
DROP POLICY IF EXISTS "Admin can read aggregate insights" ON public.aggregate_insights;
CREATE POLICY "Admin can read aggregate insights"
  ON public.aggregate_insights FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin can write aggregate insights" ON public.aggregate_insights;
CREATE POLICY "Admin can write aggregate insights"
  ON public.aggregate_insights FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can read carousel content" ON public.carousel_content;
CREATE POLICY "Admin can read carousel content"
  ON public.carousel_content FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin can write carousel content" ON public.carousel_content;
CREATE POLICY "Admin can write carousel content"
  ON public.carousel_content FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Service role bypasses RLS, so webhook handler and admin APIs work.


-- ----------------------------------------------------------------------------
-- 6. webhook_events  (source: sql/create_webhook_events.sql)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE,
  event_type TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processed', 'duplicate', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_email ON public.webhook_events(email);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency_key ON public.webhook_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);

-- DEVIATION FROM SOURCE FILE: sql/create_webhook_events.sql does not enable
-- RLS at all. This is a raw internal event log written only by service-role
-- code (GHL webhook handler) and never read by end users. Per CC-01's
-- explicit requirement ("owner-only on insights/admin tables"), RLS is
-- enabled here with NO policies, which locks the table to service_role
-- access only (service_role bypasses RLS; anon/authenticated get zero rows).
-- This is strictly more restrictive than the source file and does not change
-- any existing application code path, since only service-role code touches
-- this table today.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
