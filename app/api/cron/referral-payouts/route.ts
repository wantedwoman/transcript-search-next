import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { applyPayouts, releaseEligibleReferrals } from '@/lib/referral/lifecycle';
import type { DbClient } from '@/lib/referral/types';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/cron/referral-payouts
 *
 * Scheduled referral payout sweep (CC-04).
 *
 * Without this route the payout leg of the referral lifecycle was dead code:
 * `releaseEligibleReferrals` only ran opportunistically inside GHL webhook
 * handlers, and `applyPayouts`/`markReferralPaid` were never invoked anywhere.
 * A referral whose release hold elapsed with no subsequent webhook traffic
 * would sit `pending` forever and never reach `paid`.
 *
 * This cron guarantees both transitions run on a schedule:
 *   1. releaseEligibleReferrals — pending → released (hold window elapsed).
 *   2. applyPayouts             — released → paid once the released credit
 *                                  reaches REFERRAL_PAYOUT_THRESHOLD, writing
 *                                  the 'paid'/'applied' ledger rows.
 *
 * Guarded by CRON_SECRET (accepted via x-cron-secret, cron-secret, or a Bearer
 * Authorization header), matching the other /api/cron/* routes.
 *
 * Registered in vercel.json (daily). There is no SPA rewrite to exclude it from
 * in this repo.
 */
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
    const result = await runReferralPayoutSweep(supabase);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('cron/referral-payouts: unhandled error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Core sweep: release hold-elapsed referrals, then apply eligible payouts.
 *
 * Exported separately so the prove test can drive it against an in-memory store
 * (the same pattern the webhook handler uses for its dependency injection).
 */
export async function runReferralPayoutSweep(
  supabase: DbClient
): Promise<{ released: number; paid: number; referrers: number }> {
  const { released } = await releaseEligibleReferrals(supabase);
  const { paid, referrers } = await applyPayouts(supabase);
  return { released, paid, referrers };
}
