import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_EMAILS } from '@/lib/config/admin';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';

export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Set user status to active
    const { error } = await supabase
      .from('user_profiles')
      .update({ status: 'active', last_active: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: 'Failed to restore user' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User access restored', userId });
  } catch (error) {
    console.error('Restore user error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}