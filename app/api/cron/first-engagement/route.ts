import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getNextNudgeStage, sendFirstNudge } from '@/lib/first-engagement/sequence';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret =
      request.headers.get('x-cron-secret') ||
      request.headers.get('cron-secret') ||
      (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = createServiceRoleClient();
    const { data: members, error: membersError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('status', 'active');
    if (membersError) {
      logger.error('cron/first-engagement: failed to fetch active members', membersError);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }
    let sent = 0;
    let emailSent = 0;
    for (const member of members || []) {
      try {
        const stage = await getNextNudgeStage(member.user_id);
        if (stage === 'none') continue;
        const result = await sendFirstNudge(member.user_id, stage);
        if (result.inAppSent) sent++;
        if (result.emailSent) emailSent++;
      } catch (err) {
        logger.error(`cron/first-engagement: failed for user ${member.user_id}`, err);
      }
    }
    logger.info(`cron/first-engagement: sent=${sent}, emailSent=${emailSent}`);
    return NextResponse.json({ sent, emailSent });
  } catch (error) {
    logger.error('cron/first-engagement: unhandled error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
