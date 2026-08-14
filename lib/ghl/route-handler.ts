import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeGHLEvent,
  processGHLEvent,
  verifyGHLWebhookSignature,
  type GHLHandlerDeps,
} from './webhook-handler';
import { logger } from '../utils/logger';

/**
 * CC-04 · F-1 fix — GHL API v2 webhook envelopes.
 *
 * GHL API v2 delivers webhooks as `{ type: 'InvoicePaid', data: { contact:
 * { email }, invoice: { ... } } }` — there is no top-level `event` or `email`.
 * The route previously validated `payload.event` / `payload.email` on the raw
 * body, so every real GHL v2 payload was rejected at the boundary with
 * `{"error":"Missing event type"}` (HTTP 400) and the affiliate lifecycle never
 * ran.
 *
 * The fix: run `normalizeGHLEvent` on the parsed body FIRST, validate the
 * NORMALIZED payload, then dispatch `processGHLEvent(normalized)`. `normalizeGHLEvent`
 * maps all GHL v2 event names (InvoicePaid → payment.success, …) and lifts
 * `email`/`contact_id`/`tags`/`amount` out of the nested `data` envelope, so
 * both v2 envelopes and the legacy flat `{ event, email, ... }` shape reach the
 * handler.
 *
 * `deps` is a test seam (defaults to real implementations); the production route
 * calls this with no deps.
 */
export async function handleGHLEvent(request: NextRequest, deps: GHLHandlerDeps = {}) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-ghl-signature') || request.headers.get('x-signature');

    // Verify webhook signature
    const isValid = await verifyGHLWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.error('GHL webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      logger.error('GHL webhook: invalid JSON body');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (typeof rawPayload !== 'object' || rawPayload === null || Array.isArray(rawPayload)) {
      logger.error('GHL webhook: payload must be a JSON object');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Normalize FIRST — maps GHL v2 envelopes ({ type, data: {...} }) and the
    // legacy flat shape ({ event, email, ... }) onto the internal handler shape
    // before any validation. Without this, real GHL v2 payloads (which carry
    // `type`, not `event`, and nest the email under `data.contact.email`) would
    // be rejected with HTTP 400 and the lifecycle would never execute.
    const payload = normalizeGHLEvent(rawPayload as Record<string, unknown>);

    // Validate required fields on the NORMALIZED payload.
    if (!payload.event || payload.event === 'unknown') {
      logger.error('GHL webhook: missing event type');
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    if (!payload.email) {
      logger.error('GHL webhook: missing email');
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    // Normalize email
    payload.email = payload.email.trim().toLowerCase();

    // Generate idempotency key if not provided
    if (!payload.idempotency_key) {
      payload.idempotency_key = `${payload.event}-${payload.email}-${payload.contact_id || ''}-${Date.now()}`;
    }

    logger.info(`Processing GHL webhook: ${payload.event} for ${payload.email}`);

    const result = await processGHLEvent(payload, deps);

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
