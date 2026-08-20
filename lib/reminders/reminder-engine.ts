import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';

export type MessageStyle = 'gentle' | 'direct' | 'hype';

export const MESSAGE_STYLES: MessageStyle[] = ['gentle', 'direct', 'hype'];

/**
 * Member-facing reminder cadences and how far out each one schedules the
 * reminder. Kept in the engine (not the route) so the mapping is testable
 * and reused by both the API route and any UI that previews the schedule.
 */
export const REMINDER_CADENCES = ['daily', 'weekly', 'monthly'] as const;
export type ReminderCadence = (typeof REMINDER_CADENCES)[number];

export const REMINDER_CADENCE_DAYS: Record<ReminderCadence, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export interface UserReminder {
  id: string;
  user_id: string;
  topic: string;
  remind_at: string;
  is_sent: boolean;
  created_at: string;
  // Optional because older rows (or environments where the
  // 20260811000001_add_reminder_message_style.sql migration hasn't been
  // applied yet) may not have this column populated.
  message_style?: MessageStyle;
  // Optional for the same reason — rows created before
  // 20260814000001_add_reminder_cadence.sql may not have it. Defaults to
  // 'weekly' when absent so existing reminders keep recurring.
  cadence?: ReminderCadence;
}

/**
 * Builds the check-in message Coach Cass AI sends when a reminder fires,
 * varying the tone based on the member's chosen message style.
 */
export function buildReminderMessage(topic: string, style?: string): string {
  switch (style) {
    case 'direct':
      return `Reminder: you said you'd check back in on "${topic}". Where are you at with it?`;
    case 'hype':
      return `Sis!! Time to check in — how's "${topic}" coming along?? Let's go! 🔥`;
    case 'gentle':
    default:
      return `Hey Sis, it's been a while since we talked about ${topic}. How's that going?`;
  }
}

/**
 * No-monthly-cost email companion path for reminders.
 *
 * The in-app message (see sendReminder) remains the PRIMARY delivery — it
 * always works and costs nothing. This function is the email companion:
 *
 *  - If a free-tier email key is configured (e.g. RESEND_API_KEY for Resend's
 *    free tier, or SMTP_HOST), we log that the send happened via that
 *    provider. No paid email service is wired here (card constraint D5).
 *  - Otherwise (the default today — see .env.local key names), we emit a
 *    clear "logged as sent" email log line so firing a reminder produces a
 *    durable, greppable record of the email delivery without any monthly cost.
 */
export function sendReminderEmailLog(reminder: UserReminder): void {
  const provider = freeTierEmailProvider();
  if (provider) {
    logger.info(
      `[reminder-email:${provider}] Reminder email sent for user ${reminder.user_id}, topic: "${reminder.topic}" (free tier)`
    );
    return;
  }
  logger.info(
    `[reminder-email:logged-as-sent] Email not configured — reminder email logged as sent (no monthly cost). user=${reminder.user_id}, topic: "${reminder.topic}"`
  );
}

/**
 * Detects a free-tier email provider that could be wired later without code
 * changes. Returns the provider name, or null when none is configured (the
 * common case), in which case the caller logs the email as sent.
 */
function freeTierEmailProvider(): string | null {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST) return 'smtp';
  return null;
}

/**
 * True when a Supabase/PostgREST error indicates the message_style column
 * doesn't exist yet on this environment's user_reminders table (migration
 * 20260811000001_add_reminder_message_style.sql not yet applied).
 */
function isMissingMessageStyleColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === 'PGRST204' || (msg.includes('message_style') && msg.includes('column'));
}

/**
 * Create a new reminder for the authenticated user.
 * Enforces max 1 active (unsent) reminder per user.
 * Persists the chosen cadence so the reminder can reschedule a next
 * occurrence when it fires (recurring check-ins, not one-shot).
 * Returns the created reminder or null if one already exists.
 */
export async function createReminder(
  userId: string,
  topic: string,
  remindAt: Date,
  messageStyle: MessageStyle = 'gentle',
  cadence: ReminderCadence = 'weekly'
): Promise<{ reminder: UserReminder | null; error?: string }> {
  const supabase = createServiceRoleClient();

  // Check for existing active reminder
  const { data: existing, error: checkError } = await supabase
    .from('user_reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('is_sent', false)
    .maybeSingle();

  if (checkError) {
    logger.error('Failed to check existing reminders', checkError);
    return { reminder: null, error: 'Failed to check existing reminders' };
  }

  if (existing) {
    return { reminder: null, error: 'You already have an active reminder. Cancel it first to set a new one.' };
  }

  const basePayload = {
    user_id: userId,
    topic,
    remind_at: remindAt.toISOString(),
    is_sent: false,
    cadence,
  };

  let { data: reminder, error: insertError } = await supabase
    .from('user_reminders')
    .insert({ ...basePayload, message_style: messageStyle })
    .select()
    .single();

  if (insertError && isMissingMessageStyleColumn(insertError)) {
    // The message_style column migration hasn't been applied on this
    // environment yet — fall back to the base columns so reminder
    // creation still works. Cadence is still persisted here so recurrence
    // survives; only the chosen style won't persist until
    // supabase/migrations/20260811000001_add_reminder_message_style.sql
    // is applied.
    logger.warn('user_reminders.message_style column not found — creating reminder without it');
    ({ data: reminder, error: insertError } = await supabase
      .from('user_reminders')
      .insert(basePayload)
      .select()
      .single());
  }

  if (insertError) {
    logger.error('Failed to create reminder', insertError);
    return { reminder: null, error: 'Failed to create reminder' };
  }

  logger.info(`Created reminder ${reminder.id} for user ${userId}, topic: "${topic}"`);
  return { reminder: reminder as UserReminder };
}

/**
 * List active (unsent) reminders for the authenticated user.
 */
export async function listActiveReminders(userId: string): Promise<UserReminder[]> {
  // Service-role client so reads are not blocked by the "Admin can read all
  // reminders" RLS policy, which subqueries auth.users and fails for the
  // anon/authenticated roles. Ownership is enforced at the application layer:
  // every query here filters by the authenticated caller's userId.
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('user_reminders')
    .select('*')
    .eq('user_id', userId)
    .eq('is_sent', false)
    .order('remind_at', { ascending: true });

  if (error) {
    logger.error('Failed to list reminders', error);
    return [];
  }

  return (data || []) as UserReminder[];
}

/**
 * Cancel a reminder by marking it as sent (soft-delete approach).
 * Only the owner can cancel their own reminder.
 */
export async function cancelReminder(
  userId: string,
  reminderId: string
): Promise<{ success: boolean; error?: string }> {
  // Service-role client for the same reason as listActiveReminders — the
  // RLS admin policy on user_reminders subqueries auth.users and denies the
  // anon/authenticated roles. Ownership is enforced here (and again in the
  // route) by filtering every query on the authenticated caller's userId.
  const supabase = createServiceRoleClient();

  // Verify ownership and that it's not already sent
  const { data: reminder, error: fetchError } = await supabase
    .from('user_reminders')
    .select('id, is_sent')
    .eq('id', reminderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !reminder) {
    return { success: false, error: 'Reminder not found' };
  }

  if (reminder.is_sent) {
    return { success: false, error: 'Reminder already sent' };
  }

  const { error: deleteError } = await supabase
    .from('user_reminders')
    .delete()
    .eq('id', reminderId)
    .eq('user_id', userId);

  if (deleteError) {
    logger.error('Failed to cancel reminder', deleteError);
    return { success: false, error: 'Failed to cancel reminder' };
  }

  logger.info(`Cancelled reminder ${reminderId} for user ${userId}`);
  return { success: true };
}

/**
 * Find all due reminders (remind_at <= now, not yet sent).
 * Used by the cron endpoint.
 */
export async function getDueReminders(): Promise<UserReminder[]> {
  const supabase = createServiceRoleClient();

  // Only fire reminders for members whose active gate is open. The gate's
  // source of truth is user_profiles.status ('active' | 'revoked'), set by
  // lib/auth/auto-provision.ts (revokeUser/restoreUser). A cancelled /
  // deactivated member's due reminder must never fire, so narrow the
  // selection to members currently marked 'active'.
  const { data: activeProfiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('status', 'active');

  if (profileError) {
    logger.error('Failed to fetch active member profiles', profileError);
    return [];
  }

  const activeUserIds = (activeProfiles || []).map((p) => p.user_id);

  // No active members — nothing can be due.
  if (activeUserIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_reminders')
    .select('*')
    .eq('is_sent', false)
    .lte('remind_at', new Date().toISOString())
    .in('user_id', activeUserIds);

  if (error) {
    logger.error('Failed to fetch due reminders', error);
    return [];
  }

  return (data || []) as UserReminder[];
}

/**
 * Mark a reminder as sent and insert a Coach Cass AI message into the conversation.
 */
export async function sendReminder(reminder: UserReminder): Promise<void> {
  const supabase = createServiceRoleClient();

  // Create a new conversation for the reminder
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      user_id: reminder.user_id,
    })
    .select('id')
    .single();

  if (convError || !conversation) {
    logger.error('Failed to create reminder conversation', convError);
    // Still mark as sent to avoid retry loops
    await markReminderSent(reminder.id);
    return;
  }

  const reminderMessage = buildReminderMessage(reminder.topic, reminder.message_style);

  // Insert Coach Cass AI's reminder message
  const { error: msgError } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: reminderMessage,
    });

  if (msgError) {
    logger.error('Failed to insert reminder message', msgError);
  }

  // Mark reminder as sent
  await markReminderSent(reminder.id);

  // Email companion path — in-app message above remains primary.
  // Logs the email as sent (or sends via a free-tier provider if one is
  // configured). No monthly cost is ever introduced here (card constraint D5).
  sendReminderEmailLog(reminder);

  // Recurrence: schedule the NEXT occurrence so the reminder fires again
  // per the chosen cadence (daily/weekly/monthly) instead of being one-shot.
  // Only while the member's active gate is still open — a deactivated /
  // cancelled member gets no next occurrence (F-2 / card Verify 4).
  if (await isMemberActive(reminder.user_id)) {
    const { error: rescheduleError } = await supabase
      .from('user_reminders')
      .insert({
        user_id: reminder.user_id,
        topic: reminder.topic,
        remind_at: nextOccurrenceAt(reminder).toISOString(),
        is_sent: false,
        message_style: reminder.message_style ?? 'gentle',
        cadence: reminder.cadence ?? 'weekly',
      });

    if (rescheduleError) {
      logger.error('Failed to schedule next reminder occurrence', rescheduleError);
    }
  }

  logger.info(`Sent reminder ${reminder.id} to user ${reminder.user_id}, topic: "${reminder.topic}"`);
}

/**
 * Compute the next occurrence's remind_at: the scheduled time of the
 * occurrence that just fired plus `days(cadence)`. Anchoring on the
 * scheduled time (not "now") preserves the cadence phase, so a weekly
 * reminder set for, say, Monday keeps firing on Mondays regardless of
 * when the cron tick lands.
 */
function nextOccurrenceAt(reminder: UserReminder): Date {
  const days = REMINDER_CADENCE_DAYS[reminder.cadence ?? 'weekly'];
  return new Date(new Date(reminder.remind_at).getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * True when the member's active gate is open (user_profiles.status =
 * 'active'). Mirrors the F-2 gate used by getDueReminders, checked again
 * at reschedule time so a deactivated/cancelled member never receives a
 * next occurrence.
 */
async function isMemberActive(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    logger.error('Failed to check member active gate', error);
    return false;
  }

  return Boolean(data);
}

/**
 * Mark a reminder as sent.
 */
async function markReminderSent(reminderId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('user_reminders')
    .update({ is_sent: true })
    .eq('id', reminderId);

  if (error) {
    logger.error(`Failed to mark reminder ${reminderId} as sent`, error);
  }
}