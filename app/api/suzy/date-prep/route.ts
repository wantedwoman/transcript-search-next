import { NextResponse } from 'next/server';
import { generateDatePrep } from '@/lib/date-prep/date-prep-engine';
import { logger } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { where, feeling, communicate } = body;

    if (!where || !feeling || !communicate) {
      return NextResponse.json(
        { error: 'All fields are required: where, feeling, communicate' },
        { status: 400 }
      );
    }

    const result = await generateDatePrep({
      where: String(where).trim(),
      feeling: String(feeling).trim(),
      communicate: String(communicate).trim(),
    });

    return NextResponse.json({ prep: result.prep });
  } catch (error) {
    logger.error('Date prep route error', error);
    return NextResponse.json(
      { error: 'Could not generate your date prep. Try again in a moment.' },
      { status: 500 }
    );
  }
}