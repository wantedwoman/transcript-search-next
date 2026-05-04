import { NextResponse } from 'next/server';
import { getDateAuditEngine } from '@/lib/date-audit/date-audit-engine';
import { logger } from '@/lib/utils/logger';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    // Auth check — same pattern as chat route
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== 'string' || !input.trim()) {
      return NextResponse.json(
        { error: 'Please describe your date or paste a text exchange to analyze.' },
        { status: 400 }
      );
    }

    const engine = getDateAuditEngine();
    const result = await engine.analyze(input.trim());

    return NextResponse.json({ audit: result });
  } catch (error) {
    logger.error('Date audit API error', error);
    return NextResponse.json(
      { error: 'I ran into a problem running that audit. Please try again in a moment.' },
      { status: 500 }
    );
  }
}