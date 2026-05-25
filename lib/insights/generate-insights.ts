import { createServiceRoleClient } from '../auth/auto-provision';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface InsightResult {
  topics: string[];
  tone: string;
  key_questions: string[];
  coaching_suggestions: string[];
  summary: string;
}

const INSIGHT_PROMPT = `You are a coaching insights extractor. Analyze the following conversation between a relationship insight AI (Coach Cass AI) and a client. Extract structured insights.

Analyze and return JSON with exactly these fields:
- topics: string array of 2-5 main topics discussed (e.g., ["dating anxiety", "boundary setting", "communication"])
- tone: the client's overall emotional tone, one of: "anxious", "confident", "confused", "frustrated", "hopeful", "neutral", "sad", "empowered"
- key_questions: string array of 1-3 key questions the client asked (paraphrased concisely)
- coaching_suggestions: string array of 2-4 coaching suggestions based on the conversation (actionable, specific)
- summary: a 1-2 sentence summary of what the client was working through

Return ONLY valid JSON, no markdown, no explanation.`;

export async function generateInsights(
  userId: string,
  conversationId: string,
  messages: ConversationMessage[]
): Promise<void> {
  // Don't generate insights for very short conversations
  if (messages.length < 2) return;

  try {
    // Format messages for the LLM
    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'Client' : 'Coach Cass AI'}: ${m.content}`)
      .join('\n\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: INSIGHT_PROMPT },
          { role: 'user', content: `Analyze this conversation:\n\n${conversationText}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      logger.error(`Insight generation API error: ${response.status}`);
      return;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    let insights: InsightResult;
    try {
      insights = JSON.parse(rawContent);
    } catch {
      logger.error('Failed to parse insight JSON', rawContent);
      return;
    }

    // Validate and default missing fields
    const validatedInsights: InsightResult = {
      topics: Array.isArray(insights.topics) ? insights.topics.slice(0, 5) : [],
      tone: insights.tone || 'neutral',
      key_questions: Array.isArray(insights.key_questions) ? insights.key_questions.slice(0, 3) : [],
      coaching_suggestions: Array.isArray(insights.coaching_suggestions)
        ? insights.coaching_suggestions.slice(0, 4)
        : [],
      summary: insights.summary || '',
    };

    // Store insights in Supabase
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('user_insights').insert({
      user_id: userId,
      conversation_id: conversationId,
      date: new Date().toISOString().split('T')[0],
      topics: validatedInsights.topics,
      tone: validatedInsights.tone,
      key_questions: validatedInsights.key_questions,
      coaching_suggestions: validatedInsights.coaching_suggestions,
      summary: validatedInsights.summary,
    });

    if (error) {
      logger.error('Failed to store insights', error);
    } else {
      logger.info(`Generated insights for user ${userId}, conversation ${conversationId}`);
    }
  } catch (error) {
    logger.error('Insight generation failed', error);
    // Non-blocking — fire and forget
  }
}