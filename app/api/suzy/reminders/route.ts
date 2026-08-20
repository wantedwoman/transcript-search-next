import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  createReminder,
  listActiveReminders,
  cancelReminder,
  MESSAGE_STYLES,
  REMINDER_CADENCES,
  REMINDER_CADENCE_DAYS,
  type MessageStyle,
  type ReminderCadence,
} from '@/lib/reminders/reminder-engine';

/**
 * POST /api/suzy/reminders
 * Create a new reminder. Max 1 active reminder per user.
 * Body: {
 *   topic: string,
 *   cadence?: 'daily' | 'weekly' | 'monthly',   // maps to a remindAt Date
 *   messageStyle?: 'gentle' | 'direct' | 'hype', // persisted on the row
 *   remindAtDays?: number (1-30, legacy, default 7)
 * }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { topic, cadence, messageStyle, remindAtDays } = body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    if (topic.trim().length > 200) {
      return NextResponse.json({ error: 'Topic must be 200 characters or less' }, { status: 400 });
    }

    // Validate message style against the allowed set (mirrors the DB check
    // constraint). Defaults to 'gentle' for older clients that omit it.
    const style: MessageStyle =
      typeof messageStyle === 'string' && (MESSAGE_STYLES as string[]).includes(messageStyle)
        ? (messageStyle as MessageStyle)
        : 'gentle';

    // Cadence maps to a remindAt Date (daily/weekly/monthly). Falls back to
    // the legacy numeric remindAtDays field, then to 7 days.
    let days: number | null = null;
    let finalCadence: ReminderCadence | undefined;
    if (cadence && (REMINDER_CADENCES as readonly string[]).includes(cadence)) {
      days = REMINDER_CADENCE_DAYS[cadence as ReminderCadence];
      finalCadence = cadence as ReminderCadence;
    } else if (typeof remindAtDays === 'number' && remindAtDays >= 1 && remindAtDays <= 30) {
      days = remindAtDays;
      // Infer a cadence for the calendar event from the legacy day count.
      finalCadence = remindAtDays <= 1 ? 'daily' : remindAtDays <= 7 ? 'weekly' : 'monthly';
    }
    const finalDays = days ?? 7;

    const remindAt = new Date();
    remindAt.setDate(remindAt.getDate() + finalDays);

    const result = await createReminder(user.id, topic.trim(), remindAt, style, finalCadence);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ reminder: result.reminder }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/suzy/reminders error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/suzy/reminders
 * List active reminders for the authenticated user.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reminders = await listActiveReminders(user.id);
    return NextResponse.json({ reminders });
  } catch (error) {
    logger.error('GET /api/suzy/reminders error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/suzy/reminders
 * Cancel a reminder.
 * Body: { reminderId: string }
 */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reminderId } = body;

    if (!reminderId || typeof reminderId !== 'string') {
      return NextResponse.json({ error: 'reminderId is required' }, { status: 400 });
    }

    const result = await cancelReminder(user.id, reminderId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/suzy/reminders error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}