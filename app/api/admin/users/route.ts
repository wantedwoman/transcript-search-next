import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, user_id, email, status, created_at, last_active')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    return NextResponse.json({ users: data });
  } catch (error) {
    console.error('Failed to list users', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}