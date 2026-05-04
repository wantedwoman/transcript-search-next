import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerSupabaseClient } from '@/lib/supabase/server';
import { draftMessage, DraftTone } from '@/lib/message-drafting/draft-engine';
import { logger } from '@/lib/utils/logger';

const VALID_TONES: DraftTone[] = ['Soft', 'Direct', 'Playful', 'Vulnerable', 'Neutral'];

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rawText, tone } = body as { rawText?: string; tone?: string };

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    if (rawText.trim().length > 2000) {
      return NextResponse.json({ error: 'rawText must be 2000 characters or less' }, { status: 400 });
    }

    const normalizedTone: DraftTone = VALID_TONES.includes(tone as DraftTone)
      ? (tone as DraftTone)
      : 'Neutral';

    // Generate the drafted message via LLM
    const { draftedText } = await draftMessage(rawText.trim(), normalizedTone);

    // Save to database
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('drafted_messages')
      .insert({
        user_id: user.id,
        original_text: rawText.trim(),
        drafted_text: draftedText,
        tone: normalizedTone,
      })
      .select('id, original_text, drafted_text, tone, created_at')
      .single();

    if (error) {
      logger.error('Failed to save drafted message', error);
      // Still return the draft even if saving fails
      return NextResponse.json({
        draft: {
          original_text: rawText.trim(),
          drafted_text: draftedText,
          tone: normalizedTone,
          created_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    logger.error('Draft POST error', error);
    return NextResponse.json(
      { error: 'Failed to draft message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('drafted_messages')
      .select('id, original_text, drafted_text, tone, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Failed to fetch drafted messages', error);
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    return NextResponse.json({ drafts: data || [] });
  } catch (error) {
    logger.error('Draft GET error', error);
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}