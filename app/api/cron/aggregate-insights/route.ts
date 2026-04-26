import { NextRequest, NextResponse } from 'next/server';
import { aggregateDailyInsights } from '@/lib/insights/aggregate-insights';

// This endpoint is called by a cron job (Vercel Cron or external scheduler)
// to aggregate daily insights from user conversations.

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await aggregateDailyInsights();

    return NextResponse.json({ message: 'Daily insight aggregation completed' });
  } catch (error) {
    console.error('Cron: daily aggregation failed', error);
    return NextResponse.json({ error: 'Aggregation failed' }, { status: 500 });
  }
}