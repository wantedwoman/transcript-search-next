import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { exchangeCodeForToken } from '@/lib/google-calendar/oauth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?calendar_error=denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?calendar_error=invalid_request`);
  }

  try {
    const supabase = createServiceRoleClient();

    // Validate state (CSRF check)
    const { data: stateRow, error: stateError } = await supabase
      .from('oauth_state')
      .select('user_id')
      .eq('id', state)
      .single();

    if (stateError || !stateRow) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?calendar_error=invalid_state`);
    }

    // Invalidate state to prevent reuse
    await supabase.from('oauth_state').delete().eq('id', state);

    const { access_token, refresh_token, expires_at } = await exchangeCodeForToken(code);

    // Store the connection
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: stateRow.user_id,
        email: '', // Will be set after we fetch user info from Google
        access_token,
        refresh_token,
        expires_at: expires_at.toISOString(),
        calendar_id: 'primary',
      })
      .select()
      .single();

    if (connError || !connection) {
      console.error('Failed to store calendar connection', connError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?calendar_error=store_failed`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?calendar_connected=true`);
  } catch (err) {
    console.error('Calendar callback error', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?calendar_error=server`);
  }
}
