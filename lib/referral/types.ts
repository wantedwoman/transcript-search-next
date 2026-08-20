import { createServiceRoleClient } from '../auth/auto-provision';

/**
 * CC-04 · Affiliate/referral lifecycle — shared types.
 *
 * The service-role client is the only client allowed to move referrals
 * between states: it bypasses RLS and is used by the webhook handler and any
 * admin/cron payout sweep.
 */
export type DbClient = ReturnType<typeof createServiceRoleClient>;

/**
 * Referral state machine (CC-04):
 *
 *  pending   → new member signed up through the referrer's link (attribution)
 *            → referred member is a confirmed paying/tagged member (paid_at set)
 *            → hold period (REFERRAL_HOLD_DAYS) elapsed since attribution
 *  released  → credit earned (ledger row written), available for payout
 *  paid      → credit applied (payout threshold reached, or owner/admin action)
 */
export type ReferralStatus = 'pending' | 'released' | 'paid';

export interface ReferralRecord {
  id: string;
  referrer_user_id: string;
  referred_email: string;
  referred_user_id?: string | null;
  status: ReferralStatus;
  credit_amount?: number | string | null;
  flagged?: boolean | null;
  flag_reason?: string | null;
  created_at: string;
  released_at?: string | null;
  paid_at?: string | null;
}

/** Ledger entry kinds — 'release' marks credit earned, 'paid' marks it applied. */
export type CreditKind = 'release' | 'paid' | 'adjustment';
export type CreditStatus = 'earned' | 'applied';

export interface LedgerEntryInput {
  referralId: string;
  referrerUserId: string;
  amount: number;
  kind: CreditKind;
  status: CreditStatus;
  notes?: string;
}

export interface LedgerEntry extends LedgerEntryInput {
  id: string;
  created_at: string;
}
