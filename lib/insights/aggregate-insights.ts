import { createServiceRoleClient } from '../auth/auto-provision';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface UserInsight {
  topics: string[];
  tone: string;
  key_questions: string[];
  coaching_suggestions: string[];
  summary: string;
}

interface AggregateResult {
  trending_topics: string[];
  common_questions: string[];
  recurring_pain_points: string[];
  content_hooks: string[];
  summary: string;
}

const AGGREGATE_PROMPT = `You are a content strategist for a relationship coaching brand called WANTED Woman. Analyze the following user insights from coaching conversations and create an aggregate summary.

The brand voice is: warm, direct, culturally grounded, empowering. Target audience: professional Black women navigating love and relationships.

Return JSON with exactly these fields:
- trending_topics: string array of 5-8 most discussed topics across all users (prioritize by frequency)
- common_questions: string array of 5-8 most frequently asked questions (paraphrased to protect privacy)
- recurring_pain_points: string array of 3-5 recurring challenges or frustrations
- content_hooks: string array of 5-8 compelling social media content hooks based on these insights (attention-grabbing, relatable)
- summary: a 2-3 sentence overview of what's trending this week

Return ONLY valid JSON, no markdown.`;

export async function aggregateDailyInsights(): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    // Get today's insights
    const today = new Date().toISOString().split('T')[0];

    // Get insights from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data: insights, error } = await supabase
      .from('user_insights')
      .select('topics, tone, key_questions, coaching_suggestions, summary')
      .gte('date', sevenDaysAgo);

    if (error) {
      logger.error('Failed to fetch insights for aggregation', error);
      return;
    }

    if (!insights || insights.length === 0) {
      logger.info('No insights to aggregate');
      return;
    }

    // Format insights for the LLM
    const insightsText = (insights as UserInsight[])
      .map((insight, i) => {
        const parts = [`Insight ${i + 1}:`];
        if (insight.topics?.length) parts.push(`Topics: ${insight.topics.join(', ')}`);
        if (insight.tone) parts.push(`Tone: ${insight.tone}`);
        if (insight.key_questions?.length) parts.push(`Questions: ${insight.key_questions.join('; ')}`);
        if (insight.coaching_suggestions?.length) parts.push(`Suggestions: ${insight.coaching_suggestions.join('; ')}`);
        if (insight.summary) parts.push(`Summary: ${insight.summary}`);
        return parts.join('\n');
      })
      .join('\n\n');

    // Generate aggregate insights via LLM
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: AGGREGATE_PROMPT },
          { role: 'user', content: `Analyze these user insights:\n\n${insightsText}` },
        ],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      logger.error(`Aggregate insights API error: ${response.status}`);
      return;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    let result: AggregateResult;
    try {
      result = JSON.parse(rawContent);
    } catch {
      logger.error('Failed to parse aggregate insight JSON', rawContent);
      return;
    }

    // Store aggregate insights
    const { error: insertError } = await supabase.from('aggregate_insights').insert({
      date: today,
      trending_topics: result.trending_topics || [],
      common_questions: result.common_questions || [],
      recurring_pain_points: result.recurring_pain_points || [],
      content_hooks: result.content_hooks || [],
      summary: result.summary || '',
    });

    if (insertError) {
      logger.error('Failed to store aggregate insights', insertError);
    } else {
      logger.info(`Generated daily aggregate insights for ${today}`);
    }
  } catch (error) {
    logger.error('Daily insight aggregation failed', error);
  }
}