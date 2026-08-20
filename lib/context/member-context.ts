// CC-03: Member-aware coaching context.
//
// Loads ONLY the member's real, saved data:
//   - demographics from user_onboarding
//   - recent recurring themes/patterns from user_patterns
//   - recent extracted themes (insight extraction from conversation history)
//     from user_insights
//
// and assembles a bounded "About {name}:" block injected into the coach's
// system prompt. The block is intentionally small (no full history dump) and
// never fabricates — only fields the member actually saved are included.

import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';

export interface MemberContext {
  firstName: string | null;
  age: number | null;
  profession: string | null;
  relationshipStatus: string | null;
  hobbies: string | null;
  loveStruggles: string | null;
  topics: string[];
  tone: string | null;
  repeatQuestions: string[];
  suggestedFocus: string | null;
}

/**
 * Bounded context budget.
 * The block must stay far under the model context window — this is a
 * small personalization hint, not a history dump.
 */
export const MEMBER_CONTEXT_MAX_TOKENS = 400;
export const MEMBER_CONTEXT_MAX_CHARS = 1600;

// Per-field caps so the assembled block is naturally small.
const MAX_LOVE_STRUGGLES_CHARS = 180;
const MAX_HOBBIES_CHARS = 120;
const MAX_TOPICS = 6;
const MAX_QUESTIONS = 4;
const MAX_FOCUS_CHARS = 160;

/** Rough token estimate (English-heavy heuristic, ~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

/** True when the whole member-context block is within budget. */
export function isWithinTokenBudget(block: string): boolean {
  return estimateTokens(block) <= MEMBER_CONTEXT_MAX_TOKENS && block.length <= MEMBER_CONTEXT_MAX_CHARS;
}

// Tokens that are clearly not a person's name — never present these as a name.
const NON_NAME_TOKENS = new Set([
  'coach', 'admin', 'info', 'support', 'test', 'verify', 'judge', 'user',
  'member', 'team', 'hello', 'contact', 'noreply', 'official', 'dev', 'demo',
  'app', 'mail', 'email', 'account', 'service', 'wantedwoman', 'inspiremany',
]);

/**
 * Best-effort first name derived from the member's real email local part.
 * Returns null when a clean name cannot be derived — never guesses and never
 * presents obviously-non-name tokens (admin@, coach@, …) as a name.
 */
export function deriveFirstName(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split('@')[0] || '';
  const segments = local.split(/[^a-zA-Z]+/).filter((s) => s.length >= 3);
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (NON_NAME_TOKENS.has(lower)) continue;
    const first = segment.charAt(0).toUpperCase() + segment.slice(1);
    // Single capitalized word, letters only, reasonable name length.
    if (/^[A-Za-z][a-z]{2,23}$/.test(first)) return first;
  }
  return null;
}

function stringValue(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function numberValue(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v).trim())
    .filter((s) => s.length > 0);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Loads the member's saved context from Supabase.
 * Returns null when the member has no saved data — callers then coach generically.
 * Never throws: any lookup failure degrades to generic coaching.
 */
export async function loadMemberContext(userId: string): Promise<MemberContext | null> {
  if (!userId) return null;
  const supabase = createServiceRoleClient();

  let profileEmail: string | null = null;
  let onboarding: Record<string, unknown> | null = null;
  let pattern: Record<string, unknown> | null = null;
  let insights: Record<string, unknown>[] = [];

  try {
    const [pRes, oRes, patRes, insRes] = await Promise.all([
      supabase.from('user_profiles').select('email').eq('user_id', userId).maybeSingle(),
      supabase.from('user_onboarding').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('user_patterns')
        .select('topics_observed, tone_trend, repeat_questions, suggested_focus')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_insights')
        .select('topics, tone, key_questions, summary')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(3),
    ]);

    profileEmail = stringValue(pRes.data?.email);
    onboarding = oRes.data || null;
    pattern = patRes.data || null;
    insights = insRes.data || [];
  } catch (err) {
    logger.error('loadMemberContext: query failed', err);
    return null;
  }

  const topics = dedupe([
    ...stringArray(pattern?.topics_observed),
    ...insights.flatMap((i) => stringArray(i.topics)),
  ]).slice(0, MAX_TOPICS);

  const tone =
    stringValue(pattern?.tone_trend) ??
    insights.map((i) => stringValue(i.tone)).find((t) => t !== null) ??
    null;

  const repeatQuestions = dedupe(
    stringArray(pattern?.repeat_questions).concat(
      insights.flatMap((i) => stringArray(i.key_questions))
    )
  ).slice(0, MAX_QUESTIONS);

  const hobbies = stringValue(onboarding?.hobbies);
  const loveStruggles = stringValue(onboarding?.love_struggles);
  const suggestedFocus = stringValue(pattern?.suggested_focus);

  const context: MemberContext = {
    firstName: deriveFirstName(profileEmail),
    age: numberValue(onboarding?.age),
    profession: stringValue(onboarding?.profession),
    relationshipStatus: stringValue(onboarding?.relationship_status),
    hobbies: hobbies ? truncate(hobbies, MAX_HOBBIES_CHARS) : null,
    loveStruggles: loveStruggles ? truncate(loveStruggles, MAX_LOVE_STRUGGLES_CHARS) : null,
    topics,
    tone,
    repeatQuestions,
    suggestedFocus: suggestedFocus ? truncate(suggestedFocus, MAX_FOCUS_CHARS) : null,
  };

  const hasAnyData =
    context.age !== null ||
    context.profession !== null ||
    context.relationshipStatus !== null ||
    context.hobbies !== null ||
    context.loveStruggles !== null ||
    context.topics.length > 0 ||
    context.tone !== null ||
    context.repeatQuestions.length > 0 ||
    context.suggestedFocus !== null;

  return hasAnyData ? context : null;
}

/**
 * Builds the bounded "About {name}: …" block for the system prompt.
 * Uses only real saved data. Includes explicit no-fabrication guardrails so
 * the coach never invents demographics or life details.
 */
export function buildMemberContextBlock(context: MemberContext): string {
  const header = context.firstName
    ? `ABOUT ${context.firstName.toUpperCase()}:`
    : 'ABOUT THIS MEMBER:';

  const lines: string[] = [header];

  const identity: string[] = [];
  if (context.age !== null) identity.push(`${context.age}-year-old`);
  if (context.profession) identity.push(context.profession);
  if (context.relationshipStatus) identity.push(`currently ${context.relationshipStatus}`);
  if (identity.length > 0) {
    lines.push(`- ${identity.join(', ')}`);
  }

  if (context.loveStruggles) {
    lines.push(`- Her main love struggle: "${context.loveStruggles}"`);
  }
  if (context.hobbies) {
    lines.push(`- Hobbies/interests: ${context.hobbies}`);
  }
  if (context.topics.length > 0) {
    lines.push(`- Recurring themes she has been working through: ${context.topics.join(', ')}`);
  }
  if (context.tone) {
    lines.push(`- Recent emotional tone she has expressed: ${context.tone}`);
  }
  if (context.repeatQuestions.length > 0) {
    lines.push(`- Questions she keeps coming back to: ${context.repeatQuestions.join('; ')}`);
  }
  if (context.suggestedFocus) {
    lines.push(`- Suggested focus for her: ${context.suggestedFocus}`);
  }

  lines.push(
    '',
    'Personalization rules (must follow):',
    '- Use ONLY the facts above to make your coaching feel personal. Do not restate them mechanically.',
    '- NEVER invent or assume her age, profession, relationship status, struggles, hobbies, or any life detail not listed above.',
    '- If none of the above is relevant to her question, coach her generically with the same warmth and care.',
  );

  return lines.join('\n');
}

/**
 * One-shot helper used by the chat route: loads the member's real context and
 * builds the bounded block. Returns null (→ generic coaching) when the member
 * has no saved data or on any lookup failure.
 */
export async function loadMemberContextBlock(userId: string): Promise<string | null> {
  try {
    const context = await loadMemberContext(userId);
    if (!context) return null;
    const block = buildMemberContextBlock(context);
    if (!isWithinTokenBudget(block)) {
      logger.warn(`loadMemberContextBlock: block over budget (${estimateTokens(block)} tokens) — skipping personalization`);
      return null;
    }
    return block;
  } catch (err) {
    logger.error('loadMemberContextBlock failed', err);
    return null;
  }
}
