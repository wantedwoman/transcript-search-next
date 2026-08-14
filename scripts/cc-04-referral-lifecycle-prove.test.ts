/**
 * CC-04 prove-fixed test — Affiliate/referral lifecycle: pending → released → paid.
 *
 * "Nothing ever pays out": referrals stayed `pending` forever because no
 * lifecycle logic was wired to the GHL events. This test proves:
 *
 *  [V1] A shares a link, B signs up through it (attribution stored), B pays in
 *       GHL → webhook fires → A's referral moves pending → released (after the
 *       30-day hold) and a credit ledger row is written.
 *  [V2] B = A (self-referral) → no credit, flagged.
 *  [V3] No GHL event → no movement (pending stays).
 *  [V4] GHL API v2 event-name adapter maps InvoicePaid / ContactTagUpdate /
 *       OrderStatusUpdate onto the internal handler event names (Convention-1).
 *
 * Run with: npx tsx scripts/cc-04-referral-lifecycle-prove.test.ts
 *
 * Uses an in-memory mock Supabase client and seeded webhook payloads — no real
 * money, no network.
 */
import assert from 'node:assert/strict';

(process.env as Record<string, string | undefined>).NODE_ENV = 'development';

const {
  normalizeGHLEvent,
  processGHLEvent,
} = await import('../lib/ghl/webhook-handler');
const {
  recordAttribution,
  confirmReferralPayment,
  releaseEligibleReferrals,
  applyPayouts,
  REFERRAL_HOLD_DAYS,
  REFERRAL_CREDIT_AMOUNT,
} = await import('../lib/referral/lifecycle');

// ---------------------------------------------------------------------------
// In-memory mock Supabase client.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;
type MockResult = { data: any; error: any };

let uuidSeq = 0;
function mockUuid(): string {
  uuidSeq += 1;
  return `00000000-0000-4000-8000-${String(uuidSeq).padStart(12, '0')}`;
}

class MockStore {
  tables: Record<string, Row[]>;
  constructor(seed: Record<string, Row[]>) {
    this.tables = {};
    for (const [name, rows] of Object.entries(seed)) {
      this.tables[name] = rows.map((r) => ({ ...r }));
    }
  }
}

class MockBuilder {
  // WHERE predicates are recorded at build time and re-evaluated against the
  // CURRENT store rows at execution time — faithful to PostgREST, where an
  // UPDATE's WHERE (e.g. `status='pending'`) is applied atomically when the
  // statement runs. This is what makes the F3 concurrency race observable: a
  // racing sweep whose status-guarded claim lost the race matches 0 rows and
  // receives `{ data: [], error: null }`.
  private predicates: Array<(r: Row) => boolean> = [];
  private pendingInsert: Row[] | null = null;
  private pendingUpdate: Row | null = null;
  private selectedCols: string | null = null;
  private limitN: number | null = null;
  private orderBy: { col: string; desc: boolean } | null = null;

  constructor(private store: MockStore, private tableName: string) {}

  eq(col: string, val: any) { this.predicates.push((r) => r[col] === val); return this; }
  neq(col: string, val: any) { this.predicates.push((r) => r[col] !== val); return this; }
  not(col: string, op: string, val: any) {
    if (op === 'is' && val === null) {
      this.predicates.push((r) => r[col] !== null && r[col] !== undefined);
    } else {
      this.predicates.push((r) => r[col] !== val);
    }
    return this;
  }
  lt(col: string, val: any) {
    this.predicates.push((r) => new Date(r[col]).getTime() < new Date(val).getTime());
    return this;
  }
  lte(col: string, val: any) {
    this.predicates.push((r) => new Date(r[col]).getTime() <= new Date(val).getTime());
    return this;
  }
  gt(col: string, val: any) {
    this.predicates.push((r) => new Date(r[col]).getTime() > new Date(val).getTime());
    return this;
  }
  gte(col: string, val: any) {
    this.predicates.push((r) => new Date(r[col]).getTime() >= new Date(val).getTime());
    return this;
  }
  order(col: string, opts: { ascending?: boolean }) {
    this.orderBy = { col, desc: opts?.ascending === false };
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  select(cols?: string) { this.selectedCols = cols ?? '*'; return this; }

  insert(obj: any) { this.pendingInsert = Array.isArray(obj) ? obj : [obj]; return this; }
  update(obj: Row) { this.pendingUpdate = obj; return this; }

  async maybeSingle(): Promise<MockResult> {
    const { data, error } = await this.resolve();
    const arr = Array.isArray(data) ? data : data ? [data] : [];
    return { data: arr[0] ?? null, error };
  }
  async single(): Promise<MockResult> {
    const { data, error } = await this.resolve();
    const arr = Array.isArray(data) ? data : data ? [data] : [];
    return { data: arr[0] ?? null, error: arr.length === 0 ? new Error('row not found') : error };
  }

  // Awaited chains like `update({...}).eq('id', x).eq('status','pending')` resolve here.
  then(resolve: (v: MockResult) => any, reject: (e: any) => any) {
    return this.resolve().then(resolve, reject);
  }

  private async resolve(): Promise<MockResult> {
    if (this.pendingInsert) {
      const created: Row[] = [];
      for (const obj of this.pendingInsert) {
        const row: Row = { id: mockUuid(), created_at: new Date().toISOString(), ...obj };
        (this.store.tables[this.tableName] ??= []).push(row);
        created.push(row);
      }
      return { data: this.project(created), error: null };
    }
    // Evaluate the WHERE against the CURRENT store rows at execution time.
    const matched = (this.store.tables[this.tableName] ?? []).filter((r) =>
      this.predicates.every((p) => p(r))
    );
    if (this.pendingUpdate) {
      for (const r of matched) Object.assign(r, this.pendingUpdate);
      return { data: this.project(matched), error: null };
    }
    let rows = matched;
    if (this.orderBy) {
      const { col, desc } = this.orderBy;
      rows.sort((a, b) => {
        const av = a[col]; const bv = b[col];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return desc ? -cmp : cmp;
      });
    }
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);
    return { data: this.project(rows), error: null };
  }

  private project(rows: Row[]): Row[] {
    if (this.selectedCols && this.selectedCols !== '*') {
      const cols = this.selectedCols.split(',').map((c) => c.trim());
      return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
    }
    return rows;
  }
}

class MockSupabaseClient {
  constructor(private store: MockStore) {}
  from(table: string) { return new MockBuilder(this.store, table); }
}

function freshClient(seed: Record<string, Row[]> = {}) {
  const store = new MockStore({ referral_codes: [], user_profiles: [], referrals: [], referral_credits: [], webhook_events: [], ...seed });
  return { store, client: new MockSupabaseClient(store) as any };
}

// Webhook deps that avoid the network: no-op provision/revoke + the mock client.
function webhookDeps(client: any) {
  return {
    createServiceRoleClient: () => client,
    provisionUser: async (email: string) => ({ userId: `uid-${email}`, created: true }),
    revokeUser: async () => {},
    sendGHLWelcomeEmail: async () => {},
  };
}

const A_EMAIL = 'alice@example.com';
const B_EMAIL = 'bella@example.com';
const A_CODE = 'ALICE1';

function seedBase(extra: Row[] = []) {
  return {
    referral_codes: [{ user_id: 'uid-alice', code: A_CODE, created_at: new Date().toISOString() }],
    user_profiles: [
      { user_id: 'uid-alice', email: A_EMAIL, status: 'active' },
      ...extra,
    ],
  };
}

function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// V4 — GHL API v2 event-name adapter (Convention-1 risk).
// ---------------------------------------------------------------------------
function verifyAdapter() {
  // GHL v2 InvoicePaid → internal payment.success, nested contact email.
  const invoicePaid = normalizeGHLEvent({
    type: 'InvoicePaid',
    locationId: 'loc1',
    data: {
      contact: { id: 'contact-b', email: B_EMAIL },
      invoice: { id: 'inv-1', status: 'paid', amount: 49, currency: 'USD' },
    },
  });
  assert.equal(invoicePaid.event, 'payment.success', 'InvoicePaid maps to payment.success');
  assert.equal(invoicePaid.email, B_EMAIL, 'nested contact.email is extracted');
  assert.equal(invoicePaid.contact_id, 'contact-b', 'nested contact.id is extracted');
  assert.equal(invoicePaid.amount, 49, 'invoice amount is extracted');

  // GHL v2 InvoiceVoid → payment.failed
  assert.equal(
    normalizeGHLEvent({ type: 'InvoiceVoid', data: { invoice: { id: 'inv-2', status: 'void' } } }).event,
    'payment.failed',
    'InvoiceVoid maps to payment.failed'
  );

  // GHL v2 ContactTagUpdate (added) → contact.tagged, tags extracted.
  const tagAdded = normalizeGHLEvent({
    type: 'ContactTagUpdate',
    data: { contactId: 'contact-b', action: 'added', tag: { name: 'Coach Cass AI Subscriber' } },
  });
  assert.equal(tagAdded.event, 'contact.tagged', 'ContactTagUpdate/added maps to contact.tagged');
  assert.deepEqual(tagAdded.tags, ['Coach Cass AI Subscriber'], 'tag name extracted');

  // GHL v2 ContactTagUpdate (removed) → contact.untagged.
  assert.equal(
    normalizeGHLEvent({ type: 'ContactTagUpdate', data: { contactId: 'contact-b', action: 'removed', tag: { name: 'Member' } } }).event,
    'contact.untagged',
    'ContactTagUpdate/removed maps to contact.untagged'
  );

  // GHL v2 OrderStatusUpdate (cancelled) → payment.failed.
  assert.equal(
    normalizeGHLEvent({ type: 'OrderStatusUpdate', data: { order: { id: 'o1', status: 'cancelled' } } }).event,
    'payment.failed',
    'OrderStatusUpdate/cancelled maps to payment.failed'
  );

  // GHL v2 OrderStatusUpdate (completed) → payment.success.
  assert.equal(
    normalizeGHLEvent({ type: 'OrderStatusUpdate', data: { order: { id: 'o2', status: 'completed' } } }).event,
    'payment.success',
    'OrderStatusUpdate/completed maps to payment.success'
  );

  // Legacy flat payload passes through unchanged.
  const legacy = normalizeGHLEvent({ event: 'contact.tagged', email: B_EMAIL, tags: ['Member'] });
  assert.equal(legacy.event, 'contact.tagged', 'legacy flat event name passes through');
  assert.equal(legacy.email, B_EMAIL, 'legacy flat email passes through');

  // Unknown event → 'unknown' (logged, never crashes).
  assert.equal(normalizeGHLEvent({ type: 'TotallyUnknown' }).event, 'unknown', 'unknown event maps to unknown');

  console.log('  [V4] GHL v2 adapter mapping: PASS');
}

// ---------------------------------------------------------------------------
// V1 — Full happy path: A refers B → B pays in GHL → A's referral releases + ledger.
// ---------------------------------------------------------------------------
async function verifyHappyPath() {
  const { store, client } = freshClient(seedBase());

  // 1. B signs up through A's link → attribution stored (pending).
  const attr = await recordAttribution(client, {
    code: A_CODE,
    referredEmail: B_EMAIL,
    referredUserId: 'uid-bella',
  });
  assert.equal(attr.ok, true, 'attribution succeeds');
  assert.ok(attr.referralId, 'attribution returns a referral id');

  const pendingBefore = store.tables.referrals.find((r) => r.referred_email === B_EMAIL)!;
  assert.equal(pendingBefore.status, 'pending', 'referral starts pending');
  assert.equal(pendingBefore.flag_reason ?? null, null, 'not flagged');

  // 2. B is tagged/paid in GHL → webhook fires.
  const result = await processGHLEvent(
    {
      type: 'InvoicePaid',
      data: {
        contact: { id: 'contact-b', email: B_EMAIL },
        invoice: { id: 'inv-1', status: 'paid', amount: 49, currency: 'USD' },
      },
    },
    webhookDeps(client)
  );
  assert.equal(result.status, 'processed', 'webhook processes successfully');
  assert.equal(result.event_type, 'payment.success', 'event normalized to payment.success');

  const confirmed = store.tables.referrals.find((r) => r.referred_email === B_EMAIL)!;
  assert.equal(confirmed.status, 'pending', 'still pending immediately after payment (hold not elapsed)');
  assert.ok(confirmed.paid_at, 'payment confirmation stamped (paid_at set)');
  assert.equal(Number(confirmed.credit_amount), REFERRAL_CREDIT_AMOUNT, 'credit amount recorded');

  // 3. Hold period elapses (31 days) → release sweep moves pending → released + ledger.
  const created = new Date(confirmed.created_at);
  const { released } = await releaseEligibleReferrals(client, daysFrom(created, REFERRAL_HOLD_DAYS + 1));
  assert.equal(released, 1, 'one referral released after hold');

  const releasedRow = store.tables.referrals.find((r) => r.referred_email === B_EMAIL)!;
  assert.equal(releasedRow.status, 'released', 'referral moved to released');
  assert.ok(releasedRow.released_at, 'released_at stamped');

  const ledger = store.tables.referral_credits.filter((c) => c.referral_id === releasedRow.id);
  assert.equal(ledger.length, 1, 'a credit ledger row is written');
  assert.equal(ledger[0].kind, 'release', 'ledger kind is release');
  assert.equal(ledger[0].status, 'earned', 'ledger status is earned');
  assert.equal(ledger[0].referrer_user_id, 'uid-alice', 'ledger credits the referrer');
  assert.equal(Number(ledger[0].amount), REFERRAL_CREDIT_AMOUNT, 'ledger amount matches credit');

  console.log('  [V1] happy path pending→released + ledger: PASS');
}

// ---------------------------------------------------------------------------
// V2 — Self-referral (B = A): no credit, flagged.
// ---------------------------------------------------------------------------
async function verifySelfReferral() {
  const { store, client } = freshClient(seedBase());

  // Attribution path: A claims their own code.
  const attr = await recordAttribution(client, {
    code: A_CODE,
    referredEmail: A_EMAIL,
    referredUserId: 'uid-alice',
  });
  assert.equal(attr.ok, false, 'self-referral attribution fails');
  assert.equal(attr.flagged, true, 'self-referral flagged');

  const flaggedRow = store.tables.referrals.find((r) => r.referred_email === A_EMAIL);
  assert.ok(flaggedRow, 'flagged referral row recorded (visible)');
  assert.equal(flaggedRow.flagged, true, 'row marked flagged');
  assert.equal(flaggedRow.flag_reason, 'self_referral', 'flag reason recorded');

  // Webhook path: A pays → confirmReferralPayment must flag, never credit.
  const webhookResult = await processGHLEvent(
    { type: 'InvoicePaid', data: { contact: { id: 'contact-a', email: A_EMAIL }, invoice: { amount: 49 } } },
    webhookDeps(client)
  );
  assert.equal(webhookResult.status, 'processed', 'webhook still processes (no throw)');

  const still = store.tables.referrals.find((r) => r.referred_email === A_EMAIL)!;
  assert.equal(still.status, 'pending', 'self-referral stays pending');
  assert.equal(still.flagged, true, 'self-referral remains flagged');
  assert.equal(still.paid_at ?? null, null, 'self-referral never gets payment confirmation');

  // Release sweep must skip flagged rows — no credit ledger entries.
  const { released } = await releaseEligibleReferrals(client, daysFrom(new Date(still.created_at), REFERRAL_HOLD_DAYS + 1));
  assert.equal(released, 0, 'no release for flagged self-referral');
  const ledgerForAlice = store.tables.referral_credits.filter((c) => c.referrer_user_id === 'uid-alice');
  assert.equal(ledgerForAlice.length, 0, 'no credit ledger row for self-referral');

  console.log('  [V2] self-referral blocked + flagged, no credit: PASS');
}

// ---------------------------------------------------------------------------
// V3 — No GHL event → no movement (pending stays even after hold window).
// ---------------------------------------------------------------------------
async function verifyNoEventNoMovement() {
  const { store, client } = freshClient(seedBase());

  // C signs up through A's link but never pays / never tagged in GHL.
  const attr = await recordAttribution(client, {
    code: A_CODE,
    referredEmail: 'cara@example.com',
    referredUserId: 'uid-cara',
  });
  assert.equal(attr.ok, true, 'attribution succeeds');

  const row = store.tables.referrals.find((r) => r.referred_email === 'cara@example.com')!;
  assert.equal(row.status, 'pending', 'referral starts pending');
  assert.equal(row.paid_at ?? null, null, 'no payment confirmation (no GHL event)');

  // Even after the hold window, the release sweep finds nothing eligible.
  const { released } = await releaseEligibleReferrals(client, daysFrom(new Date(row.created_at), REFERRAL_HOLD_DAYS + 1));
  assert.equal(released, 0, 'no release without a GHL event');

  const after = store.tables.referrals.find((r) => r.referred_email === 'cara@example.com')!;
  assert.equal(after.status, 'pending', 'referral stays pending');
  const ledger = store.tables.referral_credits.filter((c) => c.referral_id === row.id);
  assert.equal(ledger.length, 0, 'no credit ledger row');

  console.log('  [V3] no GHL event → no movement: PASS');
}

// ---------------------------------------------------------------------------
// Bonus — payout: released → paid (threshold reached).
// ---------------------------------------------------------------------------
async function verifyPayout() {
  const { store, client } = freshClient(seedBase());

  // A refers two members; both pay; both clear the hold → 2 released credits.
  for (const [email, uid] of [
    ['dana@example.com', 'uid-dana'],
    ['eve@example.com', 'uid-eve'],
  ] as const) {
    await recordAttribution(client, { code: A_CODE, referredEmail: email, referredUserId: uid });
  }
  for (const email of ['dana@example.com', 'eve@example.com']) {
    await confirmReferralPayment(client, email, { amount: 49, eventType: 'payment.success' });
  }
  const dana = store.tables.referrals.find((r) => r.referred_email === 'dana@example.com')!;
  const { released } = await releaseEligibleReferrals(client, daysFrom(new Date(dana.created_at), REFERRAL_HOLD_DAYS + 1));
  assert.equal(released, 2, 'both referrals released');

  // 2 × REFERRAL_CREDIT_AMOUNT (25) = 50 → meets threshold → paid + ledger rows.
  const { paid, referrers } = await applyPayouts(client);
  assert.equal(paid, 2, 'both released referrals marked paid at threshold');
  assert.equal(referrers, 1, 'one referrer paid out');

  const paidRows = store.tables.referrals.filter((r) => r.status === 'paid');
  assert.equal(paidRows.length, 2, 'two referrals in paid state');
  const appliedLedger = store.tables.referral_credits.filter((c) => c.kind === 'paid');
  assert.equal(appliedLedger.length, 2, 'two paid ledger rows written');

  console.log('  [BONUS] payout released→paid at threshold: PASS');
}

// ---------------------------------------------------------------------------
// F3 — Concurrent release sweeps must not double-credit.
//
// Two sweeps race on the same released-eligible referral. Both select it as
// `pending`, both run the status-guarded UPDATE (`status='pending'`); the loser
// matches 0 rows. The ledger row MUST be skipped when 0 rows matched — otherwise
// both winners write a credit → DOUBLE CREDIT.
// ---------------------------------------------------------------------------
async function verifyNoDoubleCreditOnConcurrentRelease() {
  const { store, client } = freshClient(seedBase());

  await recordAttribution(client, { code: A_CODE, referredEmail: B_EMAIL, referredUserId: 'uid-bella' });
  const row = store.tables.referrals.find((r) => r.referred_email === B_EMAIL)!;
  await confirmReferralPayment(client, B_EMAIL, { amount: 49, eventType: 'payment.success' });
  const asOf = daysFrom(new Date(row.created_at), REFERRAL_HOLD_DAYS + 1);

  // Two sweeps race on the SAME eligible referral — at most one may credit.
  const [a, b] = await Promise.all([
    releaseEligibleReferrals(client, asOf),
    releaseEligibleReferrals(client, asOf),
  ]);

  const releasedTotal = a.released + b.released;
  const ledger = store.tables.referral_credits.filter((c) => c.kind === 'release');
  const finalRow = store.tables.referrals.find((r) => r.referred_email === B_EMAIL)!;

  console.log(
    `  [F3] concurrent release: sweep1=${a.released} sweep2=${b.released} ` +
      `releasedTotal=${releasedTotal} ledgerRows=${ledger.length}`
  );
  assert.equal(releasedTotal, 1, 'exactly one sweep wins the release');
  assert.equal(ledger.length, 1, 'exactly ONE credit ledger row — no double credit');
  assert.equal(finalRow.status, 'released', 'referral ends released');

  console.log('  [F3] concurrent release no-double-credit: PASS');
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('\nCC-04 referral lifecycle prove-fixed\n');
  verifyAdapter();
  await verifyHappyPath();
  await verifySelfReferral();
  await verifyNoEventNoMovement();
  await verifyPayout();
  await verifyNoDoubleCreditOnConcurrentRelease();
  console.log('\nALL ASSERTIONS PASSED — CC-04 affiliate lifecycle prove-fixed.');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
