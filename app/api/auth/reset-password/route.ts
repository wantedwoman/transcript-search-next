import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { sendBrandedResetEmail } from '@/lib/email/resend';
import { logger } from '@/lib/utils/logger';

const GENERIC_SUCCESS_MESSAGE =
  'If an account exists, you will receive a reset email shortly.';

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// Reset links are valid for one hour.
const TOKEN_TTL_MS = 60 * 60 * 1000;

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

/**
 * Resolve an auth.users id for an email address.
 *
 * 1. Prefer public.user_profiles (indexed on email) — but select `user_id`,
 *    NOT the profile row's own `id`: password_reset_tokens.user_id is a FK to
 *    auth.users(id), so inserting the profile id fails the FK constraint.
 * 2. Fall back to auth.users via the service-role admin API, for accounts that
 *    exist in Auth but have no profile row yet.
 *
 * Returns null when no account exists, so the caller can answer generically
 * without revealing which emails are registered.
 */
async function resolveUserIdByEmail(
  supabase: ServiceRoleClient,
  email: string
): Promise<string | null> {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('user_id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    logger.warn(`user_profiles lookup failed for ${email}`, profileError);
  }

  if (profile?.user_id) {
    return profile.user_id as string;
  }

  // Fallback: scan auth.users with the admin API (paginated).
  const PER_PAGE = 1000;
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (error) {
      logger.warn(`auth.admin.listUsers failed while resolving ${email}`, error);
      return null;
    }

    const match = data?.users?.find(
      (user) => user.email?.toLowerCase() === email
    );

    if (match) {
      return match.id;
    }

    if (!data?.users || data.users.length < PER_PAGE) {
      break; // last page reached
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email =
      body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Service-role client: public.password_reset_tokens has RLS enabled with no
    // policies, so an anon-key insert silently writes nothing. This client lives
    // on the server only — the key is never returned to or embedded in the client.
    const supabase = createServiceRoleClient();

    const userId = await resolveUserIdByEmail(supabase, email);

    if (!userId) {
      // Anti-enumeration: same response as the happy path, no email sent.
      logger.info(`Password reset requested for unknown email: ${email}`);
      return NextResponse.json({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
    }

    // Generate the token that will be both stored and emailed.
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // Drop any outstanding link for this user so only the newest one works.
    const { error: deleteError } = await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      // Non-fatal: a stale row would still expire on its own.
      logger.warn(`Failed to clear old reset tokens for user ${userId}`, deleteError);
    }

    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      // Never send a link we did not persist — validate-token would 404 on it.
      logger.error(`Failed to store reset token for user ${userId}`, insertError);
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    // The emailed link carries this exact token.
    try {
      await sendBrandedResetEmail(email, token);
      logger.info(`Branded reset email sent to ${email}`);
    } catch (emailError) {
      logger.error(
        'Failed to send branded reset email, falling back to Supabase',
        emailError
      );

      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://coachcass.ai'}/auth/reset-password`,
        }
      );

      if (supabaseError) {
        logger.error('Supabase email fallback also failed', supabaseError);
      }
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  } catch (error) {
    logger.error('Password reset error', error);
    return NextResponse.json(
      { error: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
