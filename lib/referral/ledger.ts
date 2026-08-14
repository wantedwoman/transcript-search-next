import { logger } from '../utils/logger';
import type { DbClient, LedgerEntry, LedgerEntryInput } from './types';

/**
 * CC-04 · Referral credit ledger.
 *
 * Every value-creating transition in the referral lifecycle is written to the
 * `referral_credits` ledger so the referrer's in-app commission credit has an
 * audit trail:
 *
 *   - release (status 'earned')  → the referral passed the hold window.
 *   - paid    (status 'applied') → the credit was applied at payout.
 *   - adjustment                 → manual corrections.
 */
export async function writeLedgerEntry(
  supabase: DbClient,
  entry: LedgerEntryInput
): Promise<{ id?: string; error?: unknown }> {
  const { data, error } = await supabase
    .from('referral_credits')
    .insert({
      referral_id: entry.referralId,
      referrer_user_id: entry.referrerUserId,
      amount: entry.amount,
      kind: entry.kind,
      status: entry.status,
      notes: entry.notes ?? null,
    })
    .select('id')
    .single();

  if (error) {
    logger.error(`[referral] ledger write failed (kind=${entry.kind})`, error);
    return { error };
  }

  logger.info(
    `[referral] ledger ${entry.kind}/${entry.status} amount=${entry.amount} referral=${entry.referralId}`
  );
  return { id: data?.id };
}

/** List a referrer's credit ledger, newest first. */
export async function listLedgerEntries(
  supabase: DbClient,
  referrerUserId: string
): Promise<LedgerEntry[]> {
  const { data } = await supabase
    .from('referral_credits')
    .select('*')
    .eq('referrer_user_id', referrerUserId)
    .order('created_at', { ascending: false });

  return (data as LedgerEntry[]) ?? [];
}
