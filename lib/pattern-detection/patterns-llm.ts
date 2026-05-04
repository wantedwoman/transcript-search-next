import { env } from '../config/env';
import { logger } from '../utils/logger';
import { PatternAnalysisResult } from './types';

const PATTERN_PROMPT = `You are a relationship coaching pattern analyst for WANTED Woman.

Analyze the provided user insights from coaching conversations. The user has been
talking with Suzy, an AI relationship coach, and their insights include topics,
emotional tone, and key questions.

Return JSON with exactly these fields:
- topics_observed: string[] — Topics that appear in 2+ conversations. Max 5. Be specific, not generic.
- tone_trend: string — Describe the emotional journey. Example: "Started anxious, showing shift toward confidence"
- repeat_questions: string[] — Questions the user keeps coming back to. Max 3.
- suggested_focus: string — One sentence suggesting the area that would benefit them most.
- heartbeat_link: string | null — If topics match a known course, suggest a link. Otherwise null.

Return ONLY valid JSON. No markdown. No explanation.`;

/**
 * Call the LLM to analyze patterns from a user's accumulated insights.
 * Returns structured pattern data or null on failure.
 */
export async function analyzePatternsWithLLM(
  insightsText: string
): Promise<PatternAnalysisResult | null> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: PATTERN_PROMPT },
          { role: 'user', content: `Analyze these user insights:\n\n${insightsText}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      logger.error(`Pattern analysis LLM error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    let result: PatternAnalysisResult;
    try {
      const parsed = JSON.parse(rawContent);
      result = {
        topics_observed: Array.isArray(parsed.topics_observed) ? parsed.topics_observed.slice(0, 5) : [],
        tone_trend: typeof parsed.tone_trend === 'string' ? parsed.tone_trend : '',
        repeat_questions: Array.isArray(parsed.repeat_questions) ? parsed.repeat_questions.slice(0, 3) : [],
        suggested_focus: typeof parsed.suggested_focus === 'string' ? parsed.suggested_focus : '',
        heartbeat_link: typeof parsed.heartbeat_link === 'string' ? parsed.heartbeat_link : null,
      };
    } catch {
      logger.error('Failed to parse pattern analysis JSON', rawContent);
      return null;
    }

    return result;
  } catch (error) {
    logger.error('Pattern analysis LLM call failed', error);
    return null;
  }
}