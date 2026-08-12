import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export type MessageStyle = 'gentle' | 'direct' | 'hype';

export const MESSAGE_STYLES: MessageStyle[] = ['gentle', 'direct', 'hype'];

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
 * Returns the created reminder or null if one already exists.
 */
export async function createReminder(
  userId: string,
  topic: string,
  remindAt: Date,
  messageStyle: MessageStyle = 'gentle'
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
  };

  let { data: reminder, error: insertError } = await supabase
    .from('user_reminders')
    .insert({ ...basePayload, message_style: messageStyle })
    .select()
    .single();

  if (insertError && isMissingMessageStyleColumn(insertError)) {
    // The message_style column migration hasn't been applied on this
    // environment yet — fall back to the base columns so reminder
    // creation still works. The chosen style just won't persist until
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
  const supabase = await createServerSupabaseClient();

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
  const supabase = await createServerSupabaseClient();

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

  const { data, error } = await supabase
    .from('user_reminders')
    .select('*')
    .eq('is_sent', false)
    .lte('remind_at', new Date().toISOString());

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

  logger.info(`Sent reminder ${reminder.id} to user ${reminder.user_id}, topic: "${reminder.topic}"`);
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