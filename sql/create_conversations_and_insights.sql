-- Conversations table: stores each chat session
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);

-- Conversation messages: individual messages within a conversation
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);

-- User insights: per-user coaching insights extracted from conversations
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

-- Aggregate insights: daily trending across all users
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

-- Carousel content: generated Instagram carousel slides
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

-- RLS policies for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregate_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_content ENABLE ROW LEVEL SECURITY;

-- Users can read their own conversations
CREATE POLICY "Users can read own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read messages in their own conversations
CREATE POLICY "Users can read own messages"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Users can insert messages in their own conversations
CREATE POLICY "Users can insert own messages"
  ON public.conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Users can read their own insights
CREATE POLICY "Users can read own insights"
  ON public.user_insights FOR SELECT
  USING (auth.uid() = user_id);

-- Admin can read all conversations
CREATE POLICY "Admin can read all conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Admin can read all messages
CREATE POLICY "Admin can read all messages"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Admin can read all insights
CREATE POLICY "Admin can read all insights"
  ON public.user_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Admin can read/write aggregate insights
CREATE POLICY "Admin can read aggregate insights"
  ON public.aggregate_insights FOR SELECT
  USING (true);

CREATE POLICY "Admin can write aggregate insights"
  ON public.aggregate_insights FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Admin can read/write carousel content
CREATE POLICY "Admin can read carousel content"
  ON public.carousel_content FOR SELECT
  USING (true);

CREATE POLICY "Admin can write carousel content"
  ON public.carousel_content FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('coach@wantedwoman.com', 'inspiremany@gmail.com')
    )
  );

-- Service role bypasses RLS, so webhook handler and admin APIs work