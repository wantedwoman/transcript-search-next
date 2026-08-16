import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { buildAuthUrl } from '@/lib/google-calendar/oauth';
import { randomUUID } from 'crypto';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Check if already connected
    const { data: existing } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already connected' }, { status: 409 });
    }

    const state = randomUUID();
    // Store state for CSRF validation (expires in 10 minutes)
    await supabase.from('oauth_state').insert({
      id: state,
      user_id: user.id,
      provider: 'google_calendar',
      created_at: new Date().toISOString(),
    });

    const authUrl = buildAuthUrl(user.id, state);
    return NextResponse.json({ url: authUrl });
  } catch (err) {
    console.error('auth-url error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
