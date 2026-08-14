import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { sendFirstNudge } from '@/lib/first-engagement/sequence';
import { logger } from '@/lib/utils/logger';

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await sendFirstNudge(user.id, 't24h', { bypassTimingGate: true });
    return NextResponse.json({ userId: user.id, ...result });
  } catch (error) {
    logger.error('first-engagement/trigger: error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
