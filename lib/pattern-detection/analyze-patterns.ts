import { createServiceRoleClient } from '../auth/auto-provision';
import { logger } from '../utils/logger';
import { analyzePatternsWithLLM } from './patterns-llm';
import { PatternAnalysisResult } from './types';

interface UserInsightRow {
  topics: string[];
  tone: string;
  key_questions: string[];
  coaching_suggestions: string[];
  summary: string;
  date: string;
}

/**
 * Check if pattern detection should run for this user, and trigger it if so.
 * This is fire-and-forget — it must NEVER block or throw to the caller.
 *
 * Gates:
 * 1. User has 3+ conversations
 * 2. Last pattern detection was 7+ days ago (or never)
 */
export async function checkAndTriggerPatternDetection(userId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    // Gate 1: Check conversation count
    const { count: conversationCount, error: countError } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      logger.error('Failed to count conversations for pattern detection', countError);
      return;
    }

    if (!conversationCount || conversationCount < 3) {
      logger.info(`Skipping pattern detection for user ${userId}: only ${conversationCount || 0} conversations`);
      return;
    }

    // Gate 2: Check last pattern detection date
    const { data: lastPattern, error: lastError } = await supabase
      .from('user_patterns')
      .select('generated_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      logger.error('Failed to check last pattern date', lastError);
      return;
    }

    if (lastPattern) {
      const lastDate = new Date(lastPattern.generated_at);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (lastDate > sevenDaysAgo) {
        logger.info(`Skipping pattern detection for user ${userId}: last detection was ${lastDate.toISOString()}`);
        return;
      }
    }

    // Fetch user_insights
    const { data: insights, error: insightsError } = await supabase
      .from('user_insights')
      .select('topics, tone, key_questions, coaching_suggestions, summary, date')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (insightsError) {
      logger.error('Failed to fetch user_insights for pattern detection', insightsError);
      return;
    }

    if (!insights || insights.length === 0) {
      logger.info(`Skipping pattern detection for user ${userId}: no insights available`);
      return;
    }

    // Format insights for LLM
    const insightsText = (insights as UserInsightRow[])
      .map((insight, i) => {
        const parts = [`Insight ${i + 1} (${insight.date}):`];
        if (insight.topics?.length) parts.push(`Topics: ${insight.topics.join(', ')}`);
        if (insight.tone) parts.push(`Tone: ${insight.tone}`);
        if (insight.key_questions?.length) parts.push(`Questions: ${insight.key_questions.join('; ')}`);
        if (insight.summary) parts.push(`Summary: ${insight.summary}`);
        return parts.join('\n');
      })
      .join('\n\n');

    // Call LLM
    const result = await analyzePatternsWithLLM(insightsText);
    if (!result) {
      logger.warn(`Pattern analysis LLM returned null for user ${userId}`);
      return;
    }

    // Check for duplicate: if topics are identical to last pattern, skip
    if (lastPattern) {
      const { data: lastPatternData } = await supabase
        .from('user_patterns')
        .select('topics_observed')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastPatternData && arraysEqual(lastPatternData.topics_observed, result.topics_observed)) {
        logger.info(`Skipping pattern detection for user ${userId}: same topics as last pattern`);
        return;
      }
    }

    // Save to user_patterns
    const { error: insertError } = await supabase.from('user_patterns').insert({
      user_id: userId,
      topics_observed: result.topics_observed,
      tone_trend: result.tone_trend,
      repeat_questions: result.repeat_questions,
      suggested_focus: result.suggested_focus,
      heartbeat_link: result.heartbeat_link,
    });

    if (insertError) {
      logger.error('Failed to store user pattern', insertError);
    } else {
      logger.info(`Pattern detected and saved for user ${userId}`);
    }
  } catch (error) {
    logger.error('Pattern detection failed', error);
    // Never re-throw — this is fire-and-forget
  }
}

function arraysEqual(a: string[] | null, b: string[]): boolean {
  if (!a) return b.length === 0;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}