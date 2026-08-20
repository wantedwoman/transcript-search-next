import { logger } from '../utils/logger';
import { writeLedgerEntry } from './ledger';
import type { DbClient, ReferralRecord } from './types';

/**
 * CC-04 · Affiliate / referral lifecycle — pending → released → paid.
 *
 * The defect this fixes: a member shares their referral link, someone joins
 * through it, pays in GHL, and the referrer is never credited — referrals stay
 * `pending` forever. This module owns the state machine:
 *
 *   1. recordAttribution      — B signs up through A's link → `pending`.
 *   2. confirmReferralPayment — GHL payment/tag event for B → `paid_at` set
 *                               (proves B is a real, paying member).
 *   3. releaseEligibleReferrals — after REFERRAL_HOLD_DAYS (default 30, the
 *                               safe refund/chargeback window) B's referral
 *                               moves `pending` → `released` and a credit
 *                               ledger row is written.
 *   4. applyPayouts / markReferralPaid — released credit is applied when the
 *                               referrer's released balance reaches
 *                               REFERRAL_PAYOUT_THRESHOLD, or on owner action.
 *
 * Safety rules:
 *   - No self-referral: if the referred member IS the referrer, the referral
 *     is flagged and never credited.
 *   - No GHL event → no movement: release requires `paid_at` to be set by a
 *     GHL payment/tag webhook. A referral that was never confirmed stays
 *     `pending` even after the hold window.
 *   - Every value-creating transition writes a row to `referral_credits`.
 */

/** Hold period before a confirmed referral is released (safe refund window). */
export const REFERRAL_HOLD_DAYS = 30;

/** Default in-app commission credit earned per qualified referral. */
export const REFERRAL_CREDIT_AMOUNT = 25;

/** Released credit balance that triggers an automatic payout. */
export const REFERRAL_PAYOUT_THRESHOLD = 50;

export const SELF_REFERRAL_FLAG = 'self_referral';

/**
 * Record a new referral attribution at signup.
 *
 * Looks up the referrer by referral code, blocks self-referrals (flagged, never
 * credited), dedupes repeated attributions, and inserts a `pending` referral.
 */
export async function recordAttribution(
  supabase: DbClient,
  input: { code: string; referredEmail: string; referredUserId?: string | null }
): Promise<{ ok: boolean; referralId?: string; flagged?: boolean }> {
  const referredEmail = input.referredEmail.trim().toLowerCase();
  const code = input.code.trim();

  if (!code || !referredEmail) {
    logger.warn('[referral] recordAttribution called without code or email');
    return { ok: false };
  }

  // Who owns this referral code?
  const { data: codeRow } = await supabase
    .from('referral_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle();

  if (!codeRow) {
    logger.info(`[referral] code not found: ${code}`);
    return { ok: false };
  }

  const referrerUserId = codeRow.user_id as string;

  // No self-referral — the referred member must not BE the referrer.
  const { data: referrerProfile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', referrerUserId)
    .maybeSingle();
  const referrerEmail = referrerProfile?.email?.trim().toLowerCase() ?? null;

  if (referrerEmail === referredEmail) {
    // Record a flagged row so the attempt is visible, but never credit it.
    await supabase.from('referrals').insert({
      referrer_user_id: referrerUserId,
      referred_email: referredEmail,
      referred_user_id: input.referredUserId ?? null,
      status: 'pending',
      flagged: true,
      flag_reason: SELF_REFERRAL_FLAG,
    });
    logger.warn(`[referral] self-referral blocked for ${referredEmail}`);
    return { ok: false, flagged: true };
  }

  // Dedupe: a given referred email is attributed to a referrer at most once.
  const { data: existing } = await supabase
    .from('referrals')
    .select('id')
    .eq('referred_email', referredEmail)
    .eq('referrer_user_id', referrerUserId)
    .limit(1);
  if (existing && existing.length > 0) {
    logger.info(`[referral] duplicate attribution skipped for ${referredEmail}`);
    return { ok: false };
  }

  const { data: inserted, error } = await supabase
    .from('referrals')
    .insert({
      referrer_user_id: referrerUserId,
      referred_email: referredEmail,
      referred_user_id: input.referredUserId ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[referral] failed to record attribution', error);
    return { ok: false };
  }

  logger.info(
    `[referral] attributed ${referredEmail} -> referrer ${referrerUserId} (${inserted?.id})`
  );
  return { ok: true, referralId: inserted?.id };
}

/**
 * Confirm that a referred member is a paying/tagged member.
 *
 * Called from the GHL webhook handler on payment/tag events. Finds the pending
 * referral attributed to the paying contact's email, re-checks self-referral,
 * and stamps `paid_at` + `credit_amount`. Without this stamp the referral can
 * never be released.
 */
export async function confirmReferralPayment(
  supabase: DbClient,
  email: string,
  meta: { contactId?: string; amount?: number; eventType?: string } = {}
): Promise<{ referral?: ReferralRecord; flagged?: boolean }> {
  const referredEmail = email.trim().toLowerCase();
  if (!referredEmail) return {};

  const { data: rows } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_email', referredEmail)
    .eq('status', 'pending')
    .limit(1);

  if (!rows || rows.length === 0) {
    logger.info(`[referral] no pending referral for paying member ${referredEmail}`);
    return {};
  }

  const referral = rows[0] as ReferralRecord;

  // Defense-in-depth self-referral guard at the payment boundary: if the
  // paying contact IS the referrer, flag the referral and never credit.
  const { data: referrerProfile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', referral.referrer_user_id)
    .maybeSingle();
  const referrerEmail = referrerProfile?.email?.trim().toLowerCase() ?? null;

  if (referrerEmail === referredEmail) {
    await supabase
      .from('referrals')
      .update({ flagged: true, flag_reason: SELF_REFERRAL_FLAG })
      .eq('id', referral.id);
    logger.warn(`[referral] self-referral blocked at payment for ${referredEmail}`);
    return { referral: { ...referral, flagged: true, flag_reason: SELF_REFERRAL_FLAG }, flagged: true };
  }

  // Never credit a referral that was already flagged (e.g., at attribution).
  if (referral.flagged) {
    logger.info(`[referral] skipped flagged referral ${referral.id}`);
    return { referral, flagged: true };
  }

  // The credit is the flat in-app commission credit (REFERRAL_CREDIT_AMOUNT),
  // not the member's payment amount — the payment amount stays in the webhook
  // audit log for reconciliation.
  const credit = toCreditAmount(referral.credit_amount);
  const paidAt = new Date().toISOString();

  const { error } = await supabase
    .from('referrals')
    .update({ paid_at: paidAt, credit_amount: credit })
    .eq('id', referral.id)
    .eq('status', 'pending');

  if (error) {
    logger.error(`[referral] failed to confirm payment for referral ${referral.id}`, error);
    return { referral };
  }

  logger.info(
    `[referral] payment confirmed for referred member ${referredEmail} ` +
      `(referrer ${referral.referrer_user_id}, event=${meta.eventType ?? 'unknown'})`
  );
  return { referral: { ...referral, paid_at: paidAt, credit_amount: credit } };
}

/**
 * Void payment confirmation on a referred member's referral.
 *
 * Called from the webhook handler when a payment fails or a subscription is
 * cancelled. Clears `paid_at`/`credit_amount` on pending referrals so a member
 * who never actually paid cannot cause a release.
 */
export async function voidReferralPayment(supabase: DbClient, email: string): Promise<void> {
  const referredEmail = email.trim().toLowerCase();
  if (!referredEmail) return;

  const { error } = await supabase
    .from('referrals')
    .update({ paid_at: null, credit_amount: null })
    .eq('referred_email', referredEmail)
    .eq('status', 'pending');

  if (error) {
    logger.error(`[referral] void referral payment failed for ${referredEmail}`, error);
  } else {
    logger.info(`[referral] voided payment confirmation for ${referredEmail}`);
  }
}

/**
 * Release sweep: move eligible pending referrals to `released`.
 *
 * A pending referral is eligible when BOTH:
 *   - its referred member's payment was confirmed by a GHL event (paid_at set),
 *   - the hold window (REFERRAL_HOLD_DAYS) has elapsed since the referral was
 *     recorded.
 *
 * Each release writes a credit ledger row (kind='release', status='earned').
 * Flagged (self-referral) rows are never released. Idempotent — the status
 * guard prevents double-release.
 */
export async function releaseEligibleReferrals(
  supabase: DbClient,
  asOf: Date = new Date()
): Promise<{ released: number }> {
  const holdMs = REFERRAL_HOLD_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(asOf.getTime() - holdMs).toISOString();

  const { data: rows } = await supabase
    .from('referrals')
    .select('*')
    .eq('status', 'pending')
    .not('paid_at', 'is', null)
    .lt('created_at', cutoff)
    .limit(100);

  if (!rows || rows.length === 0) return { released: 0 };

  let released = 0;
  for (const row of rows as ReferralRecord[]) {
    if (row.flagged) continue; // never release a flagged (self-referral) record

    const credit = toCreditAmount(row.credit_amount);
    const releasedAt = new Date().toISOString();

    const { data: updatedRows, error } = await supabase
      .from('referrals')
      .update({ status: 'released', released_at: releasedAt })
      .eq('id', row.id)
      .eq('status', 'pending') // concurrency guard — no double release
      .select('id');

    if (error) {
      logger.error(`[referral] release update failed for ${row.id}`, error);
      continue;
    }

    // The status-guarded UPDATE matched 0 rows: a concurrent sweep already
    // released this referral (lost the race). Skip the ledger write so exactly
    // one winner credits — no double credit.
    if (!updatedRows || updatedRows.length === 0) continue;

    await writeLedgerEntry(supabase, {
      referralId: row.id,
      referrerUserId: row.referrer_user_id,
      amount: credit,
      kind: 'release',
      status: 'earned',
      notes: `Referral released after ${REFERRAL_HOLD_DAYS}-day hold`,
    });
    released++;
  }

  if (released > 0) logger.info(`[referral] released ${released} referral(s)`);
  return { released };
}

/**
 * Payout sweep: move released referrals to `paid`.
 *
 * Groups a referrer's released referrals and, when their total credit reaches
 * REFERRAL_PAYOUT_THRESHOLD, marks them paid and writes a 'paid'/'applied'
 * ledger row. Pass `referrerUserId` to scope the sweep to one referrer.
 */
export async function applyPayouts(
  supabase: DbClient,
  opts: { referrerUserId?: string; asOf?: Date } = {}
): Promise<{ paid: number; referrers: number }> {
  let query = supabase.from('referrals').select('*').eq('status', 'released');
  if (opts.referrerUserId) {
    query = query.eq('referrer_user_id', opts.referrerUserId);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) return { paid: 0, referrers: 0 };

  const byReferrer = new Map<string, ReferralRecord[]>();
  for (const row of rows as ReferralRecord[]) {
    if (row.flagged) continue;
    const list = byReferrer.get(row.referrer_user_id) ?? [];
    list.push(row);
    byReferrer.set(row.referrer_user_id, list);
  }

  let paid = 0;
  let referrers = 0;
  const paidAt = new Date().toISOString();

  for (const [referrerUserId, referralRows] of byReferrer) {
    const total = referralRows.reduce(
      (sum, r) => sum + toCreditAmount(r.credit_amount),
      0
    );
    if (total < REFERRAL_PAYOUT_THRESHOLD) continue;

    for (const r of referralRows) {
      const credit = toCreditAmount(r.credit_amount);
      const { data: updatedRows, error } = await supabase
        .from('referrals')
        .update({ status: 'paid', paid_at: paidAt })
        .eq('id', r.id)
        .eq('status', 'released')
        .select('id');

      if (error) {
        logger.error(`[referral] payout update failed for ${r.id}`, error);
        continue;
      }

      // The status-guarded UPDATE matched 0 rows: a concurrent payout sweep
      // already paid this referral. Skip the ledger write — no double credit.
      if (!updatedRows || updatedRows.length === 0) continue;

      await writeLedgerEntry(supabase, {
        referralId: r.id,
        referrerUserId,
        amount: credit,
        kind: 'paid',
        status: 'applied',
        notes: 'Payout threshold reached',
      });
      paid++;
    }
    referrers++;
  }

  if (paid > 0) logger.info(`[referral] paid ${paid} referral(s) for ${referrers} referrer(s)`);
  return { paid, referrers };
}

/**
 * Mark a single released referral as paid (owner/admin action).
 */
export async function markReferralPaid(
  supabase: DbClient,
  referralId: string
): Promise<{ ok: boolean }> {
  const { data: rows } = await supabase
    .from('referrals')
    .select('*')
    .eq('id', referralId)
    .limit(1);

  const referral = rows?.[0] as ReferralRecord | undefined;
  if (!referral) {
    logger.warn(`[referral] cannot pay out unknown referral ${referralId}`);
    return { ok: false };
  }
  if (referral.status !== 'released') {
    logger.warn(`[referral] referral ${referralId} not releasable (status=${referral.status})`);
    return { ok: false };
  }

  const credit = toCreditAmount(referral.credit_amount);
  const { error } = await supabase
    .from('referrals')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', referralId)
    .eq('status', 'released');

  if (error) {
    logger.error(`[referral] manual payout update failed for ${referralId}`, error);
    return { ok: false };
  }

  await writeLedgerEntry(supabase, {
    referralId,
    referrerUserId: referral.referrer_user_id,
    amount: credit,
    kind: 'paid',
    status: 'applied',
    notes: 'Owner/admin payout action',
  });
  return { ok: true };
}

/** Coerce a stored credit amount (NUMERIC may come back as a string) to a number. */
function toCreditAmount(stored: number | string | null | undefined): number {
  const base = stored !== null && stored !== undefined ? Number(stored) : Number.NaN;
  if (Number.isFinite(base) && base > 0) return base;
  return REFERRAL_CREDIT_AMOUNT;
}
