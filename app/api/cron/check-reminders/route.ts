import { NextResponse } from 'next/server';
import { getDueReminders, sendReminder } from '@/lib/reminders/reminder-engine';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/cron/check-reminders
 * Cron endpoint to fire due reminders.
 * Should be called by a cron scheduler (e.g., Vercel Cron or external heartbeat).
 * Optionally secured via a Bearer token in the Authorization header.
 */
export async function GET(request: Request) {
  try {
    // Optional: verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dueReminders = await getDueReminders();

    if (dueReminders.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No due reminders' });
    }

    logger.info(`Processing ${dueReminders.length} due reminder(s)`);

    let sentCount = 0;
    let errorCount = 0;

    for (const reminder of dueReminders) {
      try {
        await sendReminder(reminder);
        sentCount++;
      } catch (err) {
        logger.error(`Failed to send reminder ${reminder.id}`, err);
        errorCount++;
      }
    }

    return NextResponse.json({
      sent: sentCount,
      errors: errorCount,
      total: dueReminders.length,
    });
  } catch (error) {
    logger.error('GET /api/cron/check-reminders error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}