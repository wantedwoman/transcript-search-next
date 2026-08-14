import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';
import { sendEngagementEmail } from './email';

export const T0_WELCOME_MESSAGE =
  "So glad you're here — tell me what's going on in your love life. What's your name, and what kind of support are you looking for?";

export const T24H_NUDGE_MESSAGE =
  'How did your first session go? One small step is still a step forward.';

export const T2_4_NUDGE_MESSAGE =
  'Just checking in — how is Coach Cass going for you? No pressure — I am here whenever you are ready to talk.';

const T24H_MS = 24 * 60 * 60 * 1000;
const T2_4_MIN_MS = 2 * 60 * 60 * 1000;

type Stage = 't0' | 't2_4' | 't24h';

export interface NudgeResult {
  inAppSent: boolean;
  emailSent: boolean;
  error?: string;
}

export async function hasSeenFirstWelcome(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { count, error } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) { logger.error('hasSeenFirstWelcome: count failed', error); return false; }
  return (count ?? 0) > 0;
}

async function hasAssistantMessage(userId: string, content: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId);
  if (convError) { logger.error('hasAssistantMessage: conversations lookup failed', convError); return false; }
  const conversationIds = (convs || []).map((c: { id: string }) => c.id);
  if (conversationIds.length === 0) return false;
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id')
    .in('conversation_id', conversationIds)
    .eq('role', 'assistant')
    .eq('content', content)
    .limit(1);
  if (error) { logger.error('hasAssistantMessage: message lookup failed', error); return false; }
  return (data?.length ?? 0) > 0;
}

export async function hasSentT24hNudge(userId: string): Promise<boolean> {
  return hasAssistantMessage(userId, T24H_NUDGE_MESSAGE);
}

export async function hasSentT2_4Nudge(userId: string): Promise<boolean> {
  return hasAssistantMessage(userId, T2_4_NUDGE_MESSAGE);
}

/** True if the member has sent a user-role message at/after `sinceIso` (i.e. engaged since T0). */
export async function hasUserMessageSince(userId: string, sinceIso: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId);
  if (convError) { logger.error('hasUserMessageSince: conversations lookup failed', convError); return false; }
  const conversationIds = (convs || []).map((c: { id: string }) => c.id);
  if (conversationIds.length === 0) return false;
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id')
    .in('conversation_id', conversationIds)
    .eq('role', 'user')
    .gte('created_at', sinceIso)
    .limit(1);
  if (error) { logger.error('hasUserMessageSince: message lookup failed', error); return false; }
  return (data?.length ?? 0) > 0;
}

export async function getFirstConversationCreatedAt(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) { logger.error('getFirstConversationCreatedAt: failed', error); return null; }
  return data?.[0]?.created_at ?? null;
}

export async function getNextNudgeStage(userId: string): Promise<Stage | 'none'> {
  if (!(await hasSeenFirstWelcome(userId))) return 't0';
  const createdAt = await getFirstConversationCreatedAt(userId);
  if (createdAt) {
    const age = Date.now() - new Date(createdAt).getTime();
    // T+2-4h in-app nudge (F-3): fires once for members idle since T0 (no user message in the window).
    if (age >= T2_4_MIN_MS && age < T24H_MS) {
      if (!(await hasSentT2_4Nudge(userId)) && !(await hasUserMessageSince(userId, createdAt))) {
        return 't2_4';
      }
    }
    // Respect 24h timing gate for cron — manual trigger bypasses this.
    if (age < T24H_MS) return 'none';
  }
  if (await hasSentT24hNudge(userId)) return 'none';
  return 't24h';
}

export async function getWelcomeMessage(
  userId: string
): Promise<{ content: string; conversationId: string | null }> {
  const supabase = createServiceRoleClient();
  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (convError) { logger.error('getWelcomeMessage: conversations lookup failed', convError); return { content: T0_WELCOME_MESSAGE, conversationId: null }; }
  const conversationIds = (convs || []).map((c: { id: string }) => c.id);
  if (conversationIds.length > 0) {
    const { data: existing } = await supabase
      .from('conversation_messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .eq('role', 'assistant')
      .eq('content', T0_WELCOME_MESSAGE)
      .limit(1);
    if (existing && existing.length > 0) {
      return { content: T0_WELCOME_MESSAGE, conversationId: existing[0].conversation_id };
    }
    return { content: T0_WELCOME_MESSAGE, conversationId: null };
  }
  const { data: conversation, error: createError } = await supabase
    .from('conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (createError || !conversation) { logger.error('getWelcomeMessage: create conversation failed', createError); return { content: T0_WELCOME_MESSAGE, conversationId: null }; }
  const { error: msgError } = await supabase
    .from('conversation_messages')
    .insert({ conversation_id: conversation.id, role: 'assistant', content: T0_WELCOME_MESSAGE });
  if (msgError) { logger.error('getWelcomeMessage: insert welcome message failed', msgError); }
  return { content: T0_WELCOME_MESSAGE, conversationId: conversation.id };
}

async function insertNudgeMessage(userId: string, content: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (convError || !conversation) { logger.error('insertNudgeMessage: create conversation failed', convError); return null; }
  const { error: msgError } = await supabase
    .from('conversation_messages')
    .insert({ conversation_id: conversation.id, role: 'assistant', content });
  if (msgError) { logger.error('insertNudgeMessage: insert message failed', msgError); return null; }
  return conversation.id;
}

export async function sendFirstNudge(
  userId: string,
  stage: Stage,
  options?: { bypassTimingGate?: boolean }
): Promise<NudgeResult> {
  const supabase = createServiceRoleClient();
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('status, email')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) { logger.error('sendFirstNudge: profile lookup failed', profileError); return { inAppSent: false, emailSent: false, error: 'Profile lookup failed' }; }
  if (!profile || profile.status !== 'active') { return { inAppSent: false, emailSent: false, error: 'User is not active' }; }
  if (stage === 't0') {
    if (await hasSeenFirstWelcome(userId)) { return { inAppSent: false, emailSent: false, error: 'Already welcomed' }; }
    const conversationId = await insertNudgeMessage(userId, T0_WELCOME_MESSAGE);
    if (!conversationId) { return { inAppSent: false, emailSent: false, error: 'Failed to insert T0 welcome' }; }
    logger.info(`sendFirstNudge: T0 welcome sent to user ${userId}`);
    return { inAppSent: true, emailSent: false };
  }
  if (stage === 't2_4') {
    if (!(await hasSeenFirstWelcome(userId))) { return { inAppSent: false, emailSent: false, error: 'Not welcomed yet' }; }
    if (await hasSentT2_4Nudge(userId)) { return { inAppSent: false, emailSent: false, error: 'T+2-4h nudge already sent' }; }
    // T+2-4h window + idle gate (bypassed for manual trigger). In-app only — NO email.
    if (!options?.bypassTimingGate) {
      const createdAt = await getFirstConversationCreatedAt(userId);
      if (createdAt) {
        const age = Date.now() - new Date(createdAt).getTime();
        if (age < T2_4_MIN_MS || age >= T24H_MS) { return { inAppSent: false, emailSent: false, error: 'Not in T+2-4h window' }; }
        if (await hasUserMessageSince(userId, createdAt)) { return { inAppSent: false, emailSent: false, error: 'Member engaged since T0' }; }
      }
    }
    const conversationId = await insertNudgeMessage(userId, T2_4_NUDGE_MESSAGE);
    if (!conversationId) { return { inAppSent: false, emailSent: false, error: 'Failed to insert T+2-4h nudge' }; }
    logger.info(`sendFirstNudge: T+2-4h nudge sent to user ${userId} (inApp=true, email=false)`);
    return { inAppSent: true, emailSent: false };
  }
  // stage === 't24h'
  if (!(await hasSeenFirstWelcome(userId))) { return { inAppSent: false, emailSent: false, error: 'Not welcomed yet' }; }
  if (await hasSentT24hNudge(userId)) { return { inAppSent: false, emailSent: false, error: 'T+24h nudge already sent' }; }
  // Timing gate: skip if first conversation is <24h old (bypassed for manual trigger)
  if (!options?.bypassTimingGate) {
    const createdAt = await getFirstConversationCreatedAt(userId);
    if (createdAt) {
      const age = Date.now() - new Date(createdAt).getTime();
      if (age < T24H_MS) return { inAppSent: false, emailSent: false, error: 'Not yet 24h' };
    }
  }
  const conversationId = await insertNudgeMessage(userId, T24H_NUDGE_MESSAGE);
  if (!conversationId) { return { inAppSent: false, emailSent: false, error: 'Failed to insert T+24h nudge' }; }
  const emailSent = await sendEngagementEmail(profile.email, 'How did your first session go?', T24H_NUDGE_MESSAGE);
  logger.info(`sendFirstNudge: T+24h nudge sent to user ${userId} (inApp=true, email=${emailSent})`);
  return { inAppSent: true, emailSent };
}
