import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TopicFrequency {
  topic: string;
  count: number;
}

export interface ToneTrendPoint {
  date: string;
  tone: string;
}

export interface ProgressSummary {
  overallTone: string;
  toneDirection: 'improving' | 'declining' | 'stable';
  totalConversations: number;
  dominantTopics: string[];
  summaryText: string;
}

export interface SuggestedNextStep {
  title: string;
  description: string;
  heartbeatUrl: string;
}

export interface DashboardStats {
  topics: TopicFrequency[];
  toneTrend: ToneTrendPoint[];
  progress: ProgressSummary;
  suggestedNextSteps: SuggestedNextStep[];
}

// ── Tone ordering (anxious → empowered) ──────────────────────────────────────

const TONE_ORDER: Record<string, number> = {
  anxious: 0,
  sad: 1,
  confused: 2,
  frustrated: 3,
  neutral: 4,
  hopeful: 5,
  confident: 6,
  empowered: 7,
};

const TONE_LABELS: Record<string, string> = {
  anxious: 'Anxious',
  sad: 'Sad',
  confused: 'Confused',
  frustrated: 'Frustrated',
  neutral: 'Neutral',
  hopeful: 'Hopeful',
  confident: 'Confident',
  empowered: 'Empowered',
};

// ── Heartbeat course links mapped to topics ───────────────────────────────────

const TOPIC_HEARTBEAT_MAP: Record<string, { title: string; description: string; heartbeatUrl: string }> = {
  'dating anxiety': {
    title: 'Calm Your Dating Nerves',
    description: 'Learn practical techniques to manage dating anxiety so you show up as your best self.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/dating-anxiety',
  },
  'boundary setting': {
    title: 'Set Boundaries That Stick',
    description: 'Discover how to communicate your needs clearly without guilt.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/boundary-setting',
  },
  communication: {
    title: 'Master Real Communication',
    description: 'Learn to express what you actually mean — and hear what he\'s really saying.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/communication',
  },
  'self worth': {
    title: 'Rebuild Your Self-Worth',
    description: 'Shift from seeking validation to knowing your value.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/self-worth',
  },
  'red flags': {
    title: 'Spot Red Flags Early',
    description: 'Learn the signs that save you time, energy, and heartbreak.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/red-flags',
  },
  'online dating': {
    title: 'Navigate Online Dating',
    description: 'Profile tips, messaging strategies, and energy management for the apps.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/online-dating',
  },
  trust: {
    title: 'Rebuilding Trust',
    description: 'How to open up again after betrayal — at your own pace.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/trust',
  },
  'attachment styles': {
    title: 'Understand Your Attachment Style',
    description: 'Discover why you connect the way you do — and how to create secure bonds.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/attachment-styles',
  },
  intimacy: {
    title: 'Deepen Intimacy',
    description: 'Physical and emotional intimacy that feels safe and fulfilling.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/intimacy',
  },
  'heartbreak': {
    title: 'Heal From Heartbreak',
    description: 'Move forward without carrying the past into your next chapter.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/heartbreak',
  },
  'single life': {
    title: 'Thrive While Single',
    description: 'Your single season isn\'t a waiting room — it\'s a training ground.',
    heartbeatUrl: 'https://community.reallovenetwork.com/courses/single-life',
  },
};

const DEFAULT_NEXT_STEP: SuggestedNextStep = {
  title: 'Explore The Real Love Network',
  description: 'Join our community of WANTED Women and access courses, coaching, and sisterhood.',
  heartbeatUrl: 'https://community.reallovenetwork.com/courses',
};

// ── Aggregation ──────────────────────────────────────────────────────────────

export async function aggregateUserStats(): Promise<DashboardStats | null> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return null;

    const supabase = await createServerSupabaseClient();

    // Fetch insights
    const { data: insights, error: insightsError } = await supabase
      .from('user_insights')
      .select('topics, tone, date, key_questions, coaching_suggestions, summary')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (insightsError) {
      logger.error('Dashboard: failed to fetch insights', insightsError);
      return null;
    }

    // Fetch patterns
    const { data: patterns, error: patternsError } = await supabase
      .from('user_patterns')
      .select('topics_observed, tone_trend, suggested_focus, heartbeat_link, generated_at')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: true });

    if (patternsError) {
      logger.error('Dashboard: failed to fetch patterns', patternsError);
      // Non-fatal — continue with insights only
    }

    // ── Topics ──────────────────────────────────────────────────────────

    const topicCounts: Record<string, number> = {};
    for (const insight of insights || []) {
      for (const topic of (insight.topics || [])) {
        const normalized = topic.toLowerCase().trim();
        if (normalized) {
          topicCounts[normalized] = (topicCounts[normalized] || 0) + 1;
        }
      }
    }

    // Also count topics from patterns
    for (const pattern of patterns || []) {
      for (const topic of (pattern.topics_observed || [])) {
        const normalized = topic.toLowerCase().trim();
        if (normalized) {
          topicCounts[normalized] = (topicCounts[normalized] || 0) + 1;
        }
      }
    }

    const topics: TopicFrequency[] = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── Tone Trend ──────────────────────────────────────────────────────

    const toneTrend: ToneTrendPoint[] = (insights || [])
      .filter((i: any) => i.tone && i.date)
      .map((i: any) => ({ date: i.date, tone: i.tone }));

    // ── Progress Summary ─────────────────────────────────────────────────

    const totalConversations = (insights || []).length;
    const dominantTopics = topics.slice(0, 3).map((t) => t.topic);

    // Determine overall tone
    const toneCounts: Record<string, number> = {};
    for (const insight of insights || []) {
      if (insight.tone) {
        toneCounts[insight.tone] = (toneCounts[insight.tone] || 0) + 1;
      }
    }
    const overallTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    // Determine tone direction by comparing first half vs second half
    let toneDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (toneTrend.length >= 2) {
      const midPoint = Math.floor(toneTrend.length / 2);
      const firstHalfTones = toneTrend.slice(0, midPoint).map((t) => TONE_ORDER[t.tone] ?? 4);
      const secondHalfTones = toneTrend.slice(midPoint).map((t) => TONE_ORDER[t.tone] ?? 4);
      const avgFirst = firstHalfTones.reduce((a, b) => a + b, 0) / firstHalfTones.length;
      const avgSecond = secondHalfTones.reduce((a, b) => a + b, 0) / secondHalfTones.length;
      if (avgSecond - avgFirst > 0.5) toneDirection = 'improving';
      else if (avgFirst - avgSecond > 0.5) toneDirection = 'declining';
    }

    // Build summary text
    let summaryText = '';
    if (totalConversations === 0) {
      summaryText = 'Start chatting with Suzy to see your progress here.';
    } else if (toneDirection === 'improving') {
      summaryText = `You're asking more empowered questions than before. Keep going, sis — your growth is showing.`;
    } else if (toneDirection === 'declining') {
      summaryText = `It looks like things have been feeling heavier lately. That's okay — you're still showing up, and that matters.`;
    } else {
      summaryText = `You've been consistent in your conversations. Every step counts on this journey.`;
    }

    const progress: ProgressSummary = {
      overallTone,
      toneDirection,
      totalConversations,
      dominantTopics,
      summaryText,
    };

    // ── Suggested Next Steps ─────────────────────────────────────────────

    const suggestedNextSteps: SuggestedNextStep[] = [];
    const matchedTopics = new Set<string>();

    for (const topic of dominantTopics) {
      const lower = topic.toLowerCase();
      for (const [key, value] of Object.entries(TOPIC_HEARTBEAT_MAP)) {
        if (!matchedTopics.has(key) && (lower.includes(key) || key.includes(lower))) {
          suggestedNextSteps.push(value);
          matchedTopics.add(key);
          break;
        }
      }
      if (suggestedNextSteps.length >= 3) break;
    }

    // If pattern has a suggested_focus that maps, use that too
    if (patterns && patterns.length > 0) {
      const latestPattern = patterns[patterns.length - 1];
      if (latestPattern?.suggested_focus) {
        const focusLower = latestPattern.suggested_focus.toLowerCase();
        for (const [key, value] of Object.entries(TOPIC_HEARTBEAT_MAP)) {
          if (!matchedTopics.has(key) && (focusLower.includes(key) || key.includes(focusLower))) {
            suggestedNextSteps.push(value);
            matchedTopics.add(key);
            break;
          }
        }
      }
    }

    // Always include at least one suggestion
    if (suggestedNextSteps.length === 0) {
      suggestedNextSteps.push(DEFAULT_NEXT_STEP);
    }

    return {
      topics,
      toneTrend,
      progress,
      suggestedNextSteps: suggestedNextSteps.slice(0, 3),
    };
  } catch (error) {
    logger.error('aggregateUserStats error', error);
    return null;
  }
}