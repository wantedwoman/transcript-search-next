import { provisionUser, revokeUser, sendGHLWelcomeEmail, createServiceRoleClient } from '../auth/auto-provision';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { confirmReferralPayment, releaseEligibleReferrals, voidReferralPayment } from '../referral/lifecycle';

// GHL webhook event types (internal, normalized names).
export type GHLEventType =
  | 'payment.success'
  | 'payment.failed'
  | 'subscription.cancelled'
  | 'contact.tagged'
  | 'contact.untagged'
  | 'unknown';

export interface GHLWebhookPayload {
  event: GHLEventType;
  // GHL contact fields
  email?: string;
  contact_id?: string;
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
 * CC-04 · Convention-1 risk: GHL API v2 webhook event names.
 *
 * The internal handler uses `payment.success` / `payment.failed` /
 * `subscription.cancelled` / `contact.tagged` / `contact.untagged`. GHL API v2
 * emits `InvoicePaid`, `InvoicePartiallyPaid`, `InvoiceVoid`, `OrderCreate`,
 * `OrderStatusUpdate`, `SaaSPlanCreate`, `AppPaymentStatus`, `ContactTagUpdate`
 * — with a `type` field (not `event`) and a nested `data` object.
 *
 * `normalizeGHLEvent` maps GHL v2 event names onto the internal names and
 * extracts `email`, `contact_id`, `tags` and `amount` from the various payload
 * envelopes. It accepts BOTH the legacy flat format the handler already used
 * (`{ event, email, contact_id, tags, amount }`) and GHL v2 envelopes
 * (`{ type, data: { contact: { email }, invoice: { amount }, tags } }`).
 */
export function normalizeGHLEvent(raw: Record<string, unknown>): GHLWebhookPayload {
  const source = firstString(raw.type, raw.event, raw.webhook_event, raw.trigger) ?? '';
  const data = isRecord(raw.data) ? raw.data : {};

  const event = mapGHLEventName(source, raw, data);
  const email = extractEmail(raw, data);
  const contact_id = extractContactId(raw, data);
  const tags = extractTags(raw, data);
  const amount = extractAmount(raw, data);

  // Spread raw first so normalized fields win over the original envelope.
  return { ...raw, event, email, contact_id, tags, amount } as GHLWebhookPayload;
}

// GHL v2 event name → internal normalized name. Refined by payload for the
// events whose semantics depend on an action/status field.
const GHL_V2_EVENT_MAP: Record<string, GHLEventType> = {
  InvoicePaid: 'payment.success',
  InvoicePartiallyPaid: 'payment.success',
  OrderCreate: 'payment.success',
  SaaSPlanCreate: 'payment.success',
  InvoiceVoid: 'payment.failed',
  SubscriptionCancelled: 'subscription.cancelled',
  ContactTagUpdate: 'contact.tagged',
  OrderStatusUpdate: 'payment.success',
  AppPaymentStatus: 'payment.success',
};

const INTERNAL_EVENT_NAMES: GHLEventType[] = [
  'payment.success',
  'payment.failed',
  'subscription.cancelled',
  'contact.tagged',
  'contact.untagged',
];

const FAILURE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'voided',
  'refunded',
  'failed',
  'unpaid',
  'past_due',
  'incomplete',
  'terminated',
]);

function mapGHLEventName(
  source: string,
  raw: Record<string, unknown>,
  data: Record<string, unknown>
): GHLEventType {
  if (!source) {
    logger.warn('[ghl] webhook payload missing event type');
    return 'unknown';
  }
  if ((INTERNAL_EVENT_NAMES as string[]).includes(source)) {
    return source as GHLEventType;
  }

  const mapped = GHL_V2_EVENT_MAP[source];
  if (!mapped) {
    logger.warn(`[ghl] unknown event type: ${source}`);
    return 'unknown';
  }

  if (source === 'ContactTagUpdate') {
    const action = firstString(
      getPath(data, 'action', 'action'),
      getPath(raw, 'action', 'action'),
      getPath(data, 'tagAction', 'tagAction')
    );
    return action === 'removed' || action === 'delete' ? 'contact.untagged' : 'contact.tagged';
  }

  if (source === 'OrderStatusUpdate' || source === 'AppPaymentStatus') {
    const status = firstString(
      getPath(data, 'status', 'status', 'order.status', 'subscription.status', 'invoice.status'),
      getPath(raw, 'status', 'status')
    );
    if (status && FAILURE_STATUSES.has(status.toLowerCase())) {
      return 'payment.failed';
    }
    return 'payment.success';
  }

  return mapped;
}

/** Pull a value from a nested object via dot-notation paths. */
function getPath(obj: Record<string, unknown>, ...paths: string[]): unknown {
  for (const path of paths) {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractEmail(raw: Record<string, unknown>, data: Record<string, unknown>): string | undefined {
  const candidates = [
    raw.email,
    raw.Email,
    data.email,
    data.Email,
    getPath(data, 'contact.email', 'contact.emailAddress', 'contact.Email'),
    getPath(raw, 'contact.email', 'contact.emailAddress'),
    getPath(data, 'customer.email', 'customer.emailAddress'),
    getPath(raw, 'customer.email'),
    getPath(data, 'invoice.contact.email'),
  ];
  return firstString(...candidates);
}

function extractContactId(raw: Record<string, unknown>, data: Record<string, unknown>): string | undefined {
  const candidates = [
    raw.contact_id,
    raw.contactId,
    raw.ContactId,
    data.contactId,
    data.contact_id,
    getPath(data, 'contact.id'),
    getPath(raw, 'contact.id'),
    getPath(data, 'contact.contactId'),
  ];
  return firstString(...candidates);
}

function extractTags(raw: Record<string, unknown>, data: Record<string, unknown>): string[] | undefined {
  for (const candidate of [raw.tags, data.tags, getPath(data, 'tag', 'tag.name'), raw.tag]) {
    if (Array.isArray(candidate)) {
      const tags = candidate
        .map((t) => (typeof t === 'string' ? t : isRecord(t) ? t.name : undefined))
        .filter((t): t is string => Boolean(t));
      if (tags.length > 0) return tags;
    } else if (isRecord(candidate) && typeof candidate.name === 'string') {
      return [candidate.name];
    } else if (typeof candidate === 'string' && candidate.trim()) {
      return [candidate.trim()];
    }
  }
  return undefined;
}

function extractAmount(raw: Record<string, unknown>, data: Record<string, unknown>): number | undefined {
  const candidates = [
    raw.amount,
    data.amount,
    getPath(data, 'invoice.amount', 'invoice.total', 'invoice.balance'),
    getPath(data, 'order.amount', 'order.total'),
    getPath(data, 'payment.amount'),
    getPath(data, 'subscription.amount'),
    getPath(raw, 'payment.amount'),
  ];
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
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
 * Build a deterministic idempotency key for a webhook event.
 *
 * The key is a pure function of the event CONTENT — normalized event name,
 * contact email/id, payment amount, and any natural event id embedded in the
 * envelope (invoice/order/payment/subscription id) — so a redelivered or
 * replayed webhook (identical bytes) produces the SAME key. It MUST NOT embed
 * a per-delivery timestamp (`Date.now()`) or random value: the persisted row
 * and the dedupe query both use this function, so a fresh key on every
 * delivery would make `isDuplicate` dead code and allow double-processing.
 */
export function buildIdempotencyKey(payload: Record<string, unknown>): string {
  // A key supplied by the sender (or set upstream) wins outright.
  const explicit = firstString(payload.idempotency_key);
  if (explicit) return explicit;

  const event = firstString(payload.event, payload.type) ?? 'unknown';
  const email = (firstString(payload.email, getPath(payload, 'data.contact.email')) ?? '').trim().toLowerCase();
  const contactId = firstString(
    payload.contact_id,
    payload.contactId,
    getPath(payload, 'data.contact.id', 'contact.id')
  );

  const parts: string[] = [event, email, contactId ?? ''];

  // Natural event id from the envelope — stable across redeliveries of the
  // same event and distinct across separate payments/subscriptions.
  const eventId = firstString(
    getPath(payload, 'data.invoice.id', 'invoice.id'),
    getPath(payload, 'data.order.id', 'order.id'),
    getPath(payload, 'data.payment.id', 'payment.id'),
    getPath(payload, 'data.subscription.id', 'subscription.id'),
    getPath(payload, 'data.purchase.id', 'purchase.id'),
    getPath(payload, 'data.tag.id', 'tag.id'),
    getPath(payload, 'data.id', 'id')
  );
  if (eventId) parts.push(`event:${eventId}`);

  // Payment amount, when present, is part of the payment identity.
  const amount = Number(
    getPath(
      payload,
      'amount',
      'data.amount',
      'data.invoice.amount',
      'invoice.amount',
      'data.order.amount',
      'order.amount',
      'data.payment.amount',
      'payment.amount'
    )
  );
  if (Number.isFinite(amount) && amount > 0) parts.push(`amount:${amount}`);

  // Contact tags (contact.tagged / contact.untagged) are part of identity.
  const tags = Array.isArray(payload.tags)
    ? payload.tags.filter((t): t is string => typeof t === 'string')
    : [];
  if (tags.length > 0) parts.push(`tags:${tags.slice().sort().join(',')}`);

  // Stable event timestamp carried by the payload — NOT Date.now().
  const eventDate = firstString(
    getPath(payload, 'data.createdAt', 'createdAt', 'data.eventDate', 'eventDate'),
    getPath(payload, 'data.timestamp', 'timestamp'),
    getPath(payload, 'data.invoice.date', 'invoice.date', 'data.order.date', 'order.date')
  );
  if (eventDate) parts.push(`at:${eventDate}`);

  return parts.join('|');
}

/**
 * Log a webhook event for audit trail.
 */
async function logWebhookEvent(
  supabase: ReturnType<typeof createServiceRoleClient>,
  eventType: GHLEventType,
  email: string,
  status: 'processed' | 'duplicate' | 'failed',
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('webhook_events').insert({
    event_type: eventType,
    email,
    status,
    payload,
    idempotency_key: buildIdempotencyKey(payload),
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
async function isDuplicate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  idempotencyKey: string
): Promise<boolean> {
  const { data } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Dependency seam for the handler. Defaults to the real implementations; a
 * test can inject a mock service-role client and/or no-op provision/revoke to
 * exercise the referral lifecycle without touching the network.
 */
export interface GHLHandlerDeps {
  provisionUser?: typeof provisionUser;
  revokeUser?: typeof revokeUser;
  sendGHLWelcomeEmail?: typeof sendGHLWelcomeEmail;
  createServiceRoleClient?: typeof createServiceRoleClient;
}

interface ResolvedDeps {
  provisionUser: typeof provisionUser;
  revokeUser: typeof revokeUser;
  sendGHLWelcomeEmail: typeof sendGHLWelcomeEmail;
  createServiceRoleClient: typeof createServiceRoleClient;
}

function resolveDeps(deps: GHLHandlerDeps): ResolvedDeps {
  return {
    provisionUser: deps.provisionUser ?? provisionUser,
    revokeUser: deps.revokeUser ?? revokeUser,
    sendGHLWelcomeEmail: deps.sendGHLWelcomeEmail ?? sendGHLWelcomeEmail,
    createServiceRoleClient: deps.createServiceRoleClient ?? createServiceRoleClient,
  };
}

/**
 * Process a GHL webhook event.
 *
 * Accepts either the legacy flat payload (`{ event, email, ... }`) or a raw
 * GHL API v2 envelope (`{ type, data: {...} }`) — `normalizeGHLEvent` maps the
 * names and extracts the fields before dispatch.
 */
export async function processGHLEvent(
  payload: GHLWebhookPayload | Record<string, unknown>,
  deps: GHLHandlerDeps = {}
): Promise<ProcessedEvent> {
  const D = resolveDeps(deps);

  const normalized = normalizeGHLEvent(payload as Record<string, unknown>);
  const email = normalized.email?.trim().toLowerCase();
  if (!email) {
    logger.error('GHL webhook missing email', payload);
    return {
      id: '',
      event_type: normalized.event,
      email: '',
      status: 'failed',
      created_at: new Date().toISOString(),
      payload: payload as Record<string, unknown>,
    };
  }

  // Idempotency check — the key is a deterministic function of the event
  // content (not Date.now()), so a redelivered webhook yields the same key and
  // isDuplicate below matches the row that logWebhookEvent persists.
  const idempotencyKey = buildIdempotencyKey(normalized);
  const isDup = await isDuplicate(D.createServiceRoleClient(), idempotencyKey);
  if (isDup) {
    logger.info(`Duplicate webhook event: ${idempotencyKey}`);
    await logWebhookEvent(D.createServiceRoleClient(), normalized.event, email, 'duplicate', normalized);
    return {
      id: idempotencyKey,
      event_type: normalized.event,
      email,
      status: 'duplicate',
      created_at: new Date().toISOString(),
      payload: normalized,
    };
  }

  try {
    switch (normalized.event) {
      case 'payment.success':
        await handlePaymentSuccess(email, normalized, D);
        break;
      case 'payment.failed':
        await handlePaymentFailed(email, normalized, D);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(email, normalized, D);
        break;
      case 'contact.tagged':
        await handleContactTagged(email, normalized, D);
        break;
      case 'contact.untagged':
        await handleContactUntagged(email, normalized, D);
        break;
      default:
        logger.warn(`Unknown GHL event type: ${normalized.event}`);
    }

    await logWebhookEvent(D.createServiceRoleClient(), normalized.event, email, 'processed', normalized);
    return {
      id: idempotencyKey,
      event_type: normalized.event,
      email,
      status: 'processed',
      created_at: new Date().toISOString(),
      payload: normalized,
    };
  } catch (error) {
    logger.error(`Failed to process GHL event ${normalized.event} for ${email}`, error);
    await logWebhookEvent(D.createServiceRoleClient(), normalized.event, email, 'failed', normalized);
    return {
      id: idempotencyKey,
      event_type: normalized.event,
      email,
      status: 'failed',
      created_at: new Date().toISOString(),
      payload: normalized,
    };
  }
}

async function handlePaymentSuccess(
  email: string,
  payload: GHLWebhookPayload,
  D: ResolvedDeps
): Promise<void> {
  const { userId, created } = await D.provisionUser(email);

  if (created) {
    // New user — send welcome email via GHL
    await D.sendGHLWelcomeEmail(email, payload.first_name);
    logger.info(`Payment success: provisioned new user ${email}`);
  } else {
    logger.info(`Payment success: reactivated existing user ${email}`);
  }

  // CC-04: if the paying member was referred, confirm the referral so the
  // referrer's credit can eventually release. Then run the release sweep —
  // any referrals past their hold window move pending → released.
  const supabase = D.createServiceRoleClient();
  await confirmReferralPayment(supabase, email, {
    amount: payload.amount,
    contactId: payload.contact_id,
    eventType: payload.event,
  });
  const { released } = await releaseEligibleReferrals(supabase);
  if (released > 0) {
    logger.info(`[referral] released ${released} referral(s) on payment event`);
  }
  void userId;
}

async function handlePaymentFailed(
  email: string,
  _payload: GHLWebhookPayload,
  D: ResolvedDeps
): Promise<void> {
  await D.revokeUser(email);
  // CC-04: a failed payer must not cause their referrer's credit to release.
  await voidReferralPayment(D.createServiceRoleClient(), email);
  logger.info(`Payment failed: revoked user ${email}`);
}

async function handleSubscriptionCancelled(
  email: string,
  _payload: GHLWebhookPayload,
  D: ResolvedDeps
): Promise<void> {
  await D.revokeUser(email);
  // CC-04: a cancelled payer must not cause their referrer's credit to release.
  await voidReferralPayment(D.createServiceRoleClient(), email);
  logger.info(`Subscription cancelled: revoked user ${email}`);
}

async function handleContactTagged(
  email: string,
  payload: GHLWebhookPayload,
  D: ResolvedDeps
): Promise<void> {
  // Tag added — create account if it doesn't exist
  const { created } = await D.provisionUser(email);
  if (created) {
    logger.info(`Contact tagged: provisioned new user ${email} (tags: ${payload.tags?.join(', ')})`);
  } else {
    logger.info(`Contact tagged: user already exists ${email}`);
  }

  // CC-04: a tag event is a purchase/access signal — confirm the referral.
  const supabase = D.createServiceRoleClient();
  await confirmReferralPayment(supabase, email, {
    amount: payload.amount,
    contactId: payload.contact_id,
    eventType: payload.event,
  });
  const { released } = await releaseEligibleReferrals(supabase);
  if (released > 0) {
    logger.info(`[referral] released ${released} referral(s) on tag event`);
  }
}

async function handleContactUntagged(
  email: string,
  _payload: GHLWebhookPayload,
  D: ResolvedDeps
): Promise<void> {
  // Only disable if there's no active payment
  const supabase = D.createServiceRoleClient();

  // Check if there's a recent payment.success event for this user
  const { data: paymentEvents } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('email', email)
    .eq('event_type', 'payment.success')
    .eq('status', 'processed')
    .order('created_at', { ascending: false })
    .limit(1);

  // CC-04: a member who lost their tag should not keep a confirmed referral.
  await voidReferralPayment(supabase, email);

  // If no active payment, revoke
  if (!paymentEvents || paymentEvents.length === 0) {
    await D.revokeUser(email);
    logger.info(`Contact untagged (no payment): revoked user ${email}`);
  } else {
    logger.info(`Contact untagged but has active payment: keeping ${email}`);
  }
}
