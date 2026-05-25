import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';

type ConversationRow = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type InsightRow = {
  conversation_id: string;
  tone: string | null;
  topics: string[] | null;
  summary: string | null;
};

type UserProfileRow = {
  user_id: string;
  email: string;
  status: string;
};

const ADMIN_EMAILS = ['coach@wantedwoman.com', 'inspiremany@gmail.com'];

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (convError) {
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    const conversationRows = (conversations || []) as ConversationRow[];
    const conversationIds = conversationRows.map((c) => c.id);
    const userIds = [...new Set(conversationRows.map((c) => c.user_id))];

    const [messagesResult, insightsResult, profilesResult, convoCountResult, messageCountResult, insightCountResult, activeUsersResult] = await Promise.all([
      conversationIds.length
        ? supabase
            .from('conversation_messages')
            .select('id, conversation_id, role, content, created_at')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      conversationIds.length
        ? supabase
            .from('user_insights')
            .select('conversation_id, tone, topics, summary')
            .in('conversation_id', conversationIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase
            .from('user_profiles')
            .select('user_id, email, status')
            .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('conversation_messages').select('*', { count: 'exact', head: true }),
      supabase.from('user_insights').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    if (messagesResult.error || insightsResult.error || profilesResult.error) {
      return NextResponse.json({ error: 'Failed to assemble conversation view' }, { status: 500 });
    }

    const messages = (messagesResult.data || []) as MessageRow[];
    const insights = (insightsResult.data || []) as InsightRow[];
    const profiles = (profilesResult.data || []) as UserProfileRow[];

    const messagesByConversation = new Map<string, MessageRow[]>();
    for (const message of messages) {
      const existing = messagesByConversation.get(message.conversation_id) || [];
      existing.push(message);
      messagesByConversation.set(message.conversation_id, existing);
    }

    const insightByConversation = new Map<string, InsightRow>();
    for (const insight of insights) {
      insightByConversation.set(insight.conversation_id, insight);
    }

    const profileByUserId = new Map<string, UserProfileRow>();
    for (const profile of profiles) {
      profileByUserId.set(profile.user_id, profile);
    }

    const normalized = conversationRows.map((conversation) => {
      const thread = messagesByConversation.get(conversation.id) || [];
      const insight = insightByConversation.get(conversation.id);
      const profile = profileByUserId.get(conversation.user_id);
      const firstUserMessage = thread.find((message) => message.role === 'user');
      const firstAssistantMessage = thread.find((message) => message.role === 'assistant');
      const lastMessage = thread[thread.length - 1];

      return {
        id: conversation.id,
        userId: conversation.user_id,
        email: profile?.email || 'Unknown user',
        status: profile?.status || 'unknown',
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        lastMessageAt: lastMessage?.created_at || conversation.updated_at || conversation.created_at,
        previewQuestion: firstUserMessage?.content || 'No user message saved',
        previewAnswer: firstAssistantMessage?.content || 'No Coach Cass AI response saved',
        messageCount: thread.length,
        tone: insight?.tone || null,
        topics: insight?.topics || [],
        summary: insight?.summary || null,
        messages: thread.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        })),
      };
    });

    return NextResponse.json({
      conversations: normalized,
      stats: {
        totalConversations: convoCountResult.count || 0,
        totalMessages: messageCountResult.count || 0,
        totalInsights: insightCountResult.count || 0,
        activeUsers: activeUsersResult.count || 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch admin conversations', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
