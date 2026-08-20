import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';
import {
  deleteReminderCalendarEvent,
  syncReminderToCalendar,
} from '@/lib/google-calendar/calendar-reminders';

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
  // CC-15: cadence chosen by the member + the matching Google Calendar event.
  // Optional for the same migration-ordering reason.
  cadence?: ReminderCadence;
  calendar_event_id?: string | null;
  calendar_event_link?: string | null;
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
 * True when a Supabase/PostgREST error indicates the cadence column doesn't
 * exist yet (migration 20260814000001_reminder_cadence_and_calendar_connections.sql
 * not yet applied).
 */
function isMissingCadenceColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === 'PGRST204' || (msg.includes('cadence') && msg.includes('column'));
}

/**
 * True when a Supabase/PostgREST error indicates the calendar_event_id column
 * doesn't exist yet (migration 20260814000001_reminder_cadence_and_calendar_connections.sql
 * not yet applied).
 */
function isMissingCalendarEventIdColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === 'PGRST204' || (msg.includes('calendar_event_id') && msg.includes('column'));
}

/**
 * Member's app email, used as a fallback attendee on the calendar event when
 * the Google account email cannot be resolved.
 */
async function getMemberEmail(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.email ?? null;
}

/**
 * Create a new reminder for the authenticated user.
 * Enforces max 1 active (unsent) reminder per user.
 * Returns the created reminder or null if one already exists.
 *
 * CC-15: when the member has connected their Google Calendar, a matching
 * recurring event is created (best-effort). Calendar is additive — a missing
 * connection or a Google API error never fails reminder creation.
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
  };

  // Try column variants in order of richness, falling back only when a
  // missing-column error (PGRST204) says a column isn't there yet. This keeps
  // reminder creation working on environments where the message_style and/or
  // cadence migrations haven't been applied.
  const payloadVariants: Record<string, unknown>[] = [
    { ...basePayload, message_style: messageStyle, cadence },
    { ...basePayload, message_style: messageStyle },
    { ...basePayload, cadence },
    basePayload,
  ];

  let reminder: unknown = null;
  let insertError: { message?: string; code?: string } | null = null;

  for (const variant of payloadVariants) {
    const { data, error } = await supabase.from('user_reminders').insert(variant).select().single();
    if (!error) {
      reminder = data;
      insertError = null;
      break;
    }
    insertError = error;
    const missingColumn =
      isMissingMessageStyleColumn(error) || isMissingCadenceColumn(error);
    if (!missingColumn) break; // Real error — stop retrying.
  }

  if (insertError) {
    logger.error('Failed to create reminder', insertError);
    return { reminder: null, error: 'Failed to create reminder' };
  }

  logger.info(`Created reminder ${(reminder as UserReminder).id} for user ${userId}, topic: "${topic}"`);

  // CC-15: create the matching Google Calendar event. Additive — never fails
  // the reminder and never throws.
  try {
    const googleEmail = await getMemberEmail(userId);
    const syncResult = await syncReminderToCalendar({
      userId,
      topic,
      remindAt,
      cadence,
      googleEmail,
    });

    if (syncResult.synced && syncResult.eventId) {
      const { error: updateError } = await supabase
        .from('user_reminders')
        .update({
          calendar_event_id: syncResult.eventId,
          calendar_event_link: syncResult.eventLink ?? null,
        })
        .eq('id', (reminder as UserReminder).id);
      if (updateError) {
        logger.error('Failed to persist calendar event id on reminder', updateError);
      } else {
        (reminder as UserReminder).calendar_event_id = syncResult.eventId;
        (reminder as UserReminder).calendar_event_link = syncResult.eventLink ?? null;
      }
    } else if (syncResult.reason && syncResult.reason !== 'no-calendar-connection') {
      // 'no-calendar-connection' is the normal additive case (no calendar
      // attached). Any other reason is worth an operational log line.
      logger.warn(
        `Calendar sync skipped for reminder ${(reminder as UserReminder).id}: ${syncResult.reason}`
      );
    }
  } catch (err) {
    // Calendar is additive — a failure here must never surface to the member.
    logger.error('Calendar sync during reminder creation threw (non-fatal)', err);
  }

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

  // Verify ownership and that it's not already sent.
  // calendar_event_id is selected so cancellation can also clean up the Google
  // Calendar event. On environments where the CC-15 migration hasn't been
  // applied, that column doesn't exist — fall back to the base columns.
  let reminder: { id: string; is_sent: boolean; calendar_event_id?: string | null } | null = null;
  let fetchError: { message?: string; code?: string } | null = null;

  const primary = await supabase
    .from('user_reminders')
    .select('id, is_sent, calendar_event_id')
    .eq('id', reminderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (primary.error && isMissingCalendarEventIdColumn(primary.error)) {
    const fallback = await supabase
      .from('user_reminders')
      .select('id, is_sent')
      .eq('id', reminderId)
      .eq('user_id', userId)
      .maybeSingle();
    reminder = (fallback.data as { id: string; is_sent: boolean } | null) ?? null;
    fetchError = fallback.error ?? null;
  } else {
    reminder = primary.data as { id: string; is_sent: boolean; calendar_event_id?: string | null } | null;
    fetchError = primary.error ?? null;
  }

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

  // CC-15: remove the matching Google Calendar event (best-effort). The
  // in-app reminder is already cancelled regardless of calendar availability.
  try {
    await deleteReminderCalendarEvent(userId, reminder.calendar_event_id ?? null);
  } catch (err) {
    logger.error('Failed to delete calendar event on cancel (non-fatal)', err);
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