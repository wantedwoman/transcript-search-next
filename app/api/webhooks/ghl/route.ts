import { NextRequest, NextResponse } from 'next/server';
import { buildIdempotencyKey, processGHLEvent, verifyGHLWebhookSignature } from '@/lib/ghl/webhook-handler';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-ghl-signature') || request.headers.get('x-signature');

    // Verify webhook signature
    const isValid = await verifyGHLWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.error('GHL webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      logger.error('GHL webhook: invalid JSON body');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate required fields
    if (!payload.event) {
      logger.error('GHL webhook: missing event type');
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    if (!payload.email) {
      logger.error('GHL webhook: missing email');
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    // Normalize email
    payload.email = payload.email.trim().toLowerCase();

    // Generate a deterministic idempotency key if not provided. The key is a
    // pure function of the event content (NOT Date.now()) so redeliveries of
    // the same webhook get the same key, and the dedupe in processGHLEvent
    // actually matches the row logWebhookEvent persists.
    if (!payload.idempotency_key) {
      payload.idempotency_key = buildIdempotencyKey(payload);
    }

    logger.info(`Processing GHL webhook: ${payload.event} for ${payload.email}`);

    const result = await processGHLEvent(payload);

    if (result.status === 'duplicate') {
      return NextResponse.json({ message: 'Duplicate event, already processed', id: result.id }, { status: 200 });
    }

    if (result.status === 'failed') {
      return NextResponse.json({ error: 'Failed to process event' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Event processed successfully', id: result.id }, { status: 200 });
  } catch (error) {
    logger.error('GHL webhook handler error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ghl-webhook' });
}