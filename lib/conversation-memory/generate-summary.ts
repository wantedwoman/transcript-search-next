import { logger } from '../utils/logger';
import { createServiceRoleClient } from '../auth/auto-provision';

const SUMMARY_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/**
 * Generate a compact AI summary of a conversation using OpenRouter.
 * The summary is used to populate persistent memory so Coach Cass remembers
 * previous discussions even across browser sessions.
 *
 * Returns null on any failure — never throws.
 */
export async function generateConversationSummary(
  userId: string,
  conversationId: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ summary: string; keyTopics: string[] } | null> {
  if (!OPENROUTER_API_KEY) {
    logger.warn('generateConversationSummary: OPENROUTER_API_KEY not configured');
    return null;
  }

  try {
    const systemPrompt = `You are an expert relationship coaching analyst. Your job is to create a concise, actionable summary of a coaching conversation between a client and their relationship coach.

Create a summary that captures:
1. The main topic(s) the client was working through
2. Key insights or realizations the client had
3. Specific advice or action steps given by the coach
4. Any patterns or themes in the client's situation

Keep it SHORT and USEFUL. Max 3-4 sentences. Coach Cass will read this later to remember this client — it should help her pick up where they left off.

Format your response as JSON:
{
  "summary": "A brief narrative of what was discussed and any progress made.",
  "keyTopics": ["topic1", "topic2", "topic3"]
}

Return ONLY valid JSON, no markdown, no explanation.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Here is a conversation between a client and their relationship coach. Generate a concise summary:\n\n${messages.map(m => `${m.role === 'user' ? 'Client' : 'Coach'}: ${m.content}`).join('\n\n')}`,
      },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        messages: chatMessages,
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      logger.error(`generateConversationSummary: OpenRouter error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || '';

    // Parse JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('generateConversationSummary: could not parse summary JSON', raw);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || raw.slice(0, 200),
      keyTopics: Array.isArray(parsed.keyTopics)
        ? parsed.keyTopics.slice(0, 5)
        : extractTopicsFromText(raw),
    };
  } catch (error) {
    logger.error('generateConversationSummary failed', error);
    return null;
  }
}

/**
 * Fallback: extract topics from raw text when JSON parsing fails.
 */
function extractTopicsFromText(text: string): string[] {
  const commonTopics = [
    'attraction', 'communication', 'boundaries', 'consistency',
    'confusion', 'mixed signals', 'self-worth', 'red flags',
    'dating patterns', 'emotional availability', 'trust', 'intimacy',
    'future planning', 'commitment', 'ex-relationships', 'attachment style',
  ];
  const lower = text.toLowerCase();
  return commonTopics.filter(topic => lower.includes(topic.toLowerCase()));
}

/**
 * Save a conversation summary to Supabase.
 * Upserts by conversation_id so each conversation gets summarized only once.
 */
export async function saveConversationSummary(
  userId: string,
  conversationId: string,
  summary: string,
  keyTopics: string[]
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase
      .from('conversation_summaries')
      .upsert(
        {
          user_id: userId,
          conversation_id: conversationId,
          summary,
          key_topics: keyTopics,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'conversation_id' }
      );
    logger.info(`Saved conversation summary for conv ${conversationId}`);
  } catch (error) {
    logger.error('saveConversationSummary failed', error);
  }
}

/**
 * Load all summaries for a user (most recent first).
 * Used to build the persistent memory context block.
 */
export async function loadUserSummaries(
  userId: string,
  limit: number = 5
): Promise<Array<{ conversationId: string; summary: string; keyTopics: string[] }>> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('conversation_summaries')
      .select('conversation_id, summary, key_topics, generated_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map(row => ({
      conversationId: row.conversation_id,
      summary: row.summary,
      keyTopics: row.key_topics || [],
    }));
  } catch (error) {
    logger.error('loadUserSummaries failed', error);
    return [];
  }
}
