import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';

const ADMIN_EMAILS = ['coach@wantedwoman.com', 'inspiremany@gmail.com'];

/**
 * Marks a harm alert as acknowledged (acknowledged = true).
 * Service-role client — RLS would otherwise block the write for the
 * authenticated admin session.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing alert id' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('harm_alerts')
      .update({ acknowledged: true })
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to acknowledge harm alert' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (error) {
    console.error('Failed to acknowledge harm alert', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
