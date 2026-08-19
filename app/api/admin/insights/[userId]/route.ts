import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_EMAILS } from '@/lib/config/admin';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Admin auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;
    const supabase = createServiceRoleClient();

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user insights (recent first)
    const { data: insights, error: insightsError } = await supabase
      .from('user_insights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (insightsError) {
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }

    // Get conversation count
    const { count: conversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Aggregate topic frequency
    const topicCounts: Record<string, number> = {};
    const toneCounts: Record<string, number> = {};
    const allSuggestions: string[] = [];

    (insights || []).forEach((insight: Record<string, unknown>) => {
      const topics = (insight.topics as string[]) || [];
      topics.forEach((topic) => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });

      const tone = (insight.tone as string) || 'neutral';
      toneCounts[tone] = (toneCounts[tone] || 0) + 1;

      const suggestions = (insight.coaching_suggestions as string[]) || [];
      allSuggestions.push(...suggestions);
    });

    // Sort topics by frequency
    const trendingTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Sort tones by frequency
    const toneDistribution = Object.entries(toneCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tone, count]) => ({ tone, count }));

    return NextResponse.json({
      profile,
      insights: insights || [],
      stats: {
        conversationCount: conversationCount || 0,
        insightCount: (insights || []).length,
        trendingTopics,
        toneDistribution,
        recentSuggestions: allSuggestions.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Failed to fetch user insights', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}