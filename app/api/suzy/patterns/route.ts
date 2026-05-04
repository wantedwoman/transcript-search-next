import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/suzy/patterns
 * Returns the latest unread (not read, not dismissed) pattern for the authenticated user.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    const { data: pattern, error } = await supabase
      .from('user_patterns')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_dismissed', false)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch unread pattern', error);
      return NextResponse.json({ error: 'Failed to fetch pattern' }, { status: 500 });
    }

    return NextResponse.json({ pattern: pattern || null });
  } catch (error) {
    logger.error('GET /api/suzy/patterns error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/suzy/patterns
 * Mark a pattern as read or dismissed.
 * Body: { patternId: string, action: "read" | "dismiss" }
 */
export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { patternId, action } = body;

    if (!patternId || !action) {
      return NextResponse.json({ error: 'patternId and action are required' }, { status: 400 });
    }

    if (action !== 'read' && action !== 'dismiss') {
      return NextResponse.json({ error: 'Action must be "read" or "dismiss"' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const updateData = action === 'read' ? { is_read: true } : { is_dismissed: true };

    const { error } = await supabase
      .from('user_patterns')
      .update(updateData)
      .eq('id', patternId)
      .eq('user_id', user.id); // Ensure user owns this pattern

    if (error) {
      logger.error('Failed to update pattern', error);
      return NextResponse.json({ error: 'Failed to update pattern' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PATCH /api/suzy/patterns error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}