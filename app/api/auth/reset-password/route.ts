import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { sendBrandedResetEmail } from '@/lib/email/resend';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if user exists
    const { data: users, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .limit(1);

    if (userError || !users || users.length === 0) {
      // Don't reveal whether email exists — still return success to prevent enumeration
      logger.info(`Password reset requested for unknown email: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'If an account exists, you will receive a reset email shortly.',
      });
    }

    // Generate a secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token (upsert to handle multiple requests)
    await supabase.from('password_reset_tokens').upsert(
      {
        user_id: users[0].id,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    // Send branded email
    try {
      await sendBrandedResetEmail(email, token);
      logger.info(`Branded reset email sent to ${email}`);
    } catch (emailError) {
      logger.error('Failed to send branded reset email, falling back to Supabase', emailError);
      // Fall back to Supabase email
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      });
      if (supabaseError) {
        logger.error('Supabase email fallback also failed', supabaseError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists, you will receive a reset email shortly.',
    });
  } catch (error) {
    logger.error('Password reset error', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
