import { provisionUser, revokeUser, sendGHLWelcomeEmail, createServiceRoleClient } from '../auth/auto-provision';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// GHL webhook event types
export type GHLEventType =
  | 'payment.success'
  | 'payment.failed'
  | 'subscription.cancelled'
  | 'contact.tagged'
  | 'contact.untagged';

export interface GHLWebhookPayload {
  event: GHLEventType;
  // GHL contact fields
  contact_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string[];
  // Payment fields
  amount?: number;
  currency?: string;
  product_name?: string;
  subscription_id?: string;
  // Idempotency
  idempotency_key?: string;
  // Raw payload for logging
  [key: string]: unknown;
}

interface ProcessedEvent {
  id: string;
  event_type: GHLEventType;
  email: string;
  status: 'processed' | 'duplicate' | 'failed';
  created_at: string;
  payload: Record<string, unknown>;
}

/**
 * Verify GHL webhook signature.
 * GHL signs webhooks with a signature that can be verified using the webhook secret.
 */
export async function verifyGHLWebhookSignature(
  payload: string,
  signature: string | null
): Promise<boolean> {
  if (!env.GHL_WEBHOOK_SECRET || env.GHL_WEBHOOK_SECRET === '') {
    // In development, skip verification if no secret is configured
    if (env.NODE_ENV === 'development') {
      logger.warn('GHL webhook signature verification skipped (no secret configured, dev mode)');
      return true;
    }
    logger.error('GHL webhook secret not configured');
    return false;
  }

  if (!signature) {
    logger.error('No GHL webhook signature provided');
    return false;
  }

  // GHL uses HMAC-SHA256 for webhook signatures
  // The signature is computed as: HMAC-SHA256(webhook_secret, raw_body)
  const encoder = new TextEncoder();
  const key = encoder.encode(env.GHL_WEBHOOK_SECRET);
  const data = encoder.encode(payload);

  // Using Web Crypto API (available in Edge Runtime and Node.js 18+)
  return crypto.subtle
    .importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then((cryptoKey) => crypto.subtle.sign('HMAC', cryptoKey, data))
    .then((sig) => {
      const computed = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return computed === signature;
    })
    .catch(() => {
      logger.error('Failed to verify GHL webhook signature');
      return false;
    });
}

/**
 * Log a webhook event for audit trail.
 */
async function logWebhookEvent(
  eventType: GHLEventType,
  email: string,
  status: 'processed' | 'duplicate' | 'failed',
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('webhook_events').insert({
    event_type: eventType,
    email,
    status,
    payload,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Log but don't throw — logging is non-critical
    logger.error('Failed to log webhook event', error);
  }
}

/**
 * Check idempotency — has this event already been processed?
 */
async function isDuplicate(idempotencyKey: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Process a GHL webhook event.
 */
export async function processGHLEvent(payload: GHLWebhookPayload): Promise<ProcessedEvent> {
  const email = payload.email?.trim().toLowerCase();
  if (!email) {
    logger.error('GHL webhook missing email', payload);
    return {
      id: '',
      event_type: payload.event,
      email: '',
      status: 'failed',
      created_at: new Date().toISOString(),
      payload: payload as Record<string, unknown>,
    };
  }

  // Idempotency check
  const idempotencyKey = payload.idempotency_key || `${payload.event}-${email}-${payload.contact_id || ''}-${Date.now()}`;
  const isDup = await isDuplicate(idempotencyKey);
  if (isDup) {
    logger.info(`Duplicate webhook event: ${idempotencyKey}`);
    await logWebhookEvent(payload.event, email, 'duplicate', payload as Record<string, unknown>);
    return {
      id: idempotencyKey,
      event_type: payload.event,
      email,
      status: 'duplicate',
      created_at: new Date().toISOString(),
      payload: payload as Record<string, unknown>,
    };
  }

  try {
    switch (payload.event) {
      case 'payment.success':
        await handlePaymentSuccess(email, payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(email, payload);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(email, payload);
        break;
      case 'contact.tagged':
        await handleContactTagged(email, payload);
        break;
      case 'contact.untagged':
        await handleContactUntagged(email, payload);
        break;
      default:
        logger.warn(`Unknown GHL event type: ${payload.event}`);
    }

    await logWebhookEvent(payload.event, email, 'processed', payload as Record<string, unknown>);
    return {
      id: idempotencyKey,
      event_type: payload.event,
      email,
      status: 'processed',
      created_at: new Date().toISOString(),
      payload: payload as Record<string, unknown>,
    };
  } catch (error) {
    logger.error(`Failed to process GHL event ${payload.event} for ${email}`, error);
    await logWebhookEvent(payload.event, email, 'failed', payload as Record<string, unknown>);
    return {
      id: idempotencyKey,
      event_type: payload.event,
      email,
      status: 'failed',
      created_at: new Date().toISOString(),
      payload: payload as Record<string, unknown>,
    };
  }
}

async function handlePaymentSuccess(email: string, payload: GHLWebhookPayload): Promise<void> {
  const { userId, created } = await provisionUser(email);

  if (created) {
    // New user — send welcome email via GHL
    await sendGHLWelcomeEmail(email, payload.first_name);
    logger.info(`Payment success: provisioned new user ${email}`);
  } else {
    logger.info(`Payment success: reactivated existing user ${email}`);
  }
}

async function handlePaymentFailed(email: string, _payload: GHLWebhookPayload): Promise<void> {
  await revokeUser(email);
  logger.info(`Payment failed: revoked user ${email}`);
}

async function handleSubscriptionCancelled(email: string, _payload: GHLWebhookPayload): Promise<void> {
  await revokeUser(email);
  logger.info(`Subscription cancelled: revoked user ${email}`);
}

async function handleContactTagged(email: string, payload: GHLWebhookPayload): Promise<void> {
  // Tag added — create account if it doesn't exist
  const { created } = await provisionUser(email);
  if (created) {
    logger.info(`Contact tagged: provisioned new user ${email} (tags: ${payload.tags?.join(', ')})`);
  } else {
    logger.info(`Contact tagged: user already exists ${email}`);
  }
}

async function handleContactUntagged(email: string, _payload: GHLWebhookPayload): Promise<void> {
  // Only disable if there's no active payment
  const supabase = createServiceRoleClient();

  // Check if there's a recent payment.success event for this user
  const { data: paymentEvents } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('email', email)
    .eq('event_type', 'payment.success')
    .eq('status', 'processed')
    .order('created_at', { ascending: false })
    .limit(1);

  // If no active payment, revoke
  if (!paymentEvents || paymentEvents.length === 0) {
    await revokeUser(email);
    logger.info(`Contact untagged (no payment): revoked user ${email}`);
  } else {
    logger.info(`Contact untagged but has active payment: keeping ${email}`);
  }
}