import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { createReminder, listActiveReminders, cancelReminder } from '@/lib/reminders/reminder-engine';

/**
 * POST /api/suzy/reminders
 * Create a new reminder. Max 1 active reminder per user.
 * Body: { topic: string, remindAtDays?: number (default 7) }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { topic, remindAtDays } = body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    if (topic.trim().length > 200) {
      return NextResponse.json({ error: 'Topic must be 200 characters or less' }, { status: 400 });
    }

    // Default: remind in 7 days
    const days = typeof remindAtDays === 'number' && remindAtDays >= 1 && remindAtDays <= 30
      ? remindAtDays
      : 7;

    const remindAt = new Date();
    remindAt.setDate(remindAt.getDate() + days);

    const result = await createReminder(user.id, topic.trim(), remindAt);

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