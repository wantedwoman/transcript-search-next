import { NextRequest, NextResponse } from 'next/server';
import { checkGhlTags } from '@/lib/ghl/check-tags';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, refCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // 1. Verify the email has the "Coach Cass AI Subscriber" tag in GHL
    const { hasAccess, tags } = await checkGhlTags(email);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            'Access by invitation only. Purchase through WANTED Woman to get started.',
        },
        { status: 403 }
      );
    }

    // 2. Create the Supabase user
    const supabase = createServiceRoleClient();
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      console.error('Supabase create user error:', createError);
      return NextResponse.json(
        { error: createError.message || 'Failed to create account.' },
        { status: 500 }
      );
    }

    // 3. Handle referral tracking (fire-and-forget, non-blocking)
    if (refCode && userData.user?.id) {
      trackReferral(supabase, refCode, userData.user.id, email).catch(() => {
        // Silently ignore — referral tracking is non-critical
      });
    }

    return NextResponse.json({
      success: true,
      user: { id: userData.user?.id, email: userData.user?.email },
    });
  } catch (err: any) {
    console.error('Signup route error:', err);
    return NextResponse.json(
      { error: err.message || 'Something went wrong.' },
      { status: 500 }
    );
  }
}

/**
 * Track a referral: look up the referrer's code and create a referral record.
 */
async function trackReferral(
  supabase: ReturnType<typeof createServiceRoleClient>,
  refCode: string,
  newUserId: string,
  newEmail: string
): Promise<void> {
  try {
    // Look up who owns this referral code
    const { data: refCodeData } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('code', refCode)
      .single();

    if (!refCodeData) {
      logger.info(`Referral code ${refCode} not found — skipping referral tracking`);
      return;
    }

    // Don't allow self-referrals
    if (refCodeData.user_id === newUserId) {
      logger.info('Self-referral detected — skipping');
      return;
    }

    // Create referral record
    const { error } = await supabase.from('referrals').insert({
      referrer_user_id: refCodeData.user_id,
      referred_email: newEmail,
      status: 'pending',
    });

    if (error) {
      logger.error('Failed to create referral record', error);
    } else {
      logger.info(`Tracked referral: ${refCode} -> ${newEmail}`);
    }
  } catch (err) {
    logger.error('Referral tracking error', err);
  }
}