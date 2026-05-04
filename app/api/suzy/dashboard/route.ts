import { NextResponse } from 'next/server';
import { aggregateUserStats } from '@/lib/dashboard/aggregate-user-stats';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/suzy/dashboard
 * Returns the aggregated Love Life Dashboard stats for the authenticated user.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await aggregateUserStats();

    if (!stats) {
      return NextResponse.json({ error: 'Failed to load dashboard stats' }, { status: 500 });
    }

    return NextResponse.json(stats);
  } catch (error) {
    logger.error('GET /api/suzy/dashboard error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}