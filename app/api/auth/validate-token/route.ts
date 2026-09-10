import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: resetToken, error } = await supabase
      .from('password_reset_tokens')
      .select('expires_at')
      .eq('token', token)
      .single();

    if (error || !resetToken) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    const isValid = new Date(resetToken.expires_at) > new Date();

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    logger.error('Token validation error', error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
