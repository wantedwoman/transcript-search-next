import { NextRequest, NextResponse } from 'next/server';
import { handleGHLEvent } from '@/lib/ghl/route-handler';

export async function POST(request: NextRequest) {
  return handleGHLEvent(request);
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ghl-webhook' });
}
