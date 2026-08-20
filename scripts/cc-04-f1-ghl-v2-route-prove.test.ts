/**
 * CC-04 · F-1 prove-fixed — GHL v2 webhook envelope reaches the lifecycle.
 *
 * Finding F-1: `app/api/webhooks/ghl/route.ts` validated `payload.event` /
 * `payload.email` on the RAW body BEFORE calling `processGHLEvent`, so a real
 * GHL API v2 webhook envelope — `{ type: 'InvoicePaid', data: { contact:
 * { email }, invoice: { ... } } }` — was rejected at the boundary with HTTP 400
 * `{"error":"Missing event type"}`. `normalizeGHLEvent` maps all 8 GHL v2 event
 * names, but was UNREACHABLE via the real route. Net effect: the whole
 * affiliate lifecycle never executed in production.
 *
 * This test imports the REAL route handler (`handleGHLEvent` — the exact code
 * `POST` in `app/api/webhooks/ghl/route.ts` delegates to), constructs a
 * `NextRequest`, and POSTs the exact GHL v2 envelope from the finding. It proves:
 *
 *   [F1-a] BEFORE — the raw v2 envelope has no top-level `event`/`email`, so the
 *          old boundary validation rejected it (documents the defect).
 *   [F1-b] AFTER — the route normalizes first, returns HTTP 200, and the
 *          release/ledger path runs: a `referral_credits` row (kind='release')
 *          is created for the referrer.
 *   [F1-c] The legacy flat v1 path still works end-to-end through the route.
 *
 * Run with: npx tsx scripts/cc-04-f1-ghl-v2-route-prove.test.ts
 *
 * Uses an in-memory mock Supabase client and injected webhook deps — no network.
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

(process.env as Record<string, string | undefined>).NODE_ENV = 'development';

const { handleGHLEvent } = await import('../lib/ghl/route-handler');
const { normalizeGHLEvent } = await import('../lib/ghl/webhook-handler');
const {
  recordAttribution,
  confirmReferralPayment,
  releaseEligibleReferrals,
  REFERRAL_HOLD_DAYS,
  REFERRAL_CREDIT_AMOUNT,
} = await import('../lib/referral/lifecycle');

// ---------------------------------------------------------------------------
// In-memory mock Supabase client (same harness as cc-04-referral-lifecycle-prove).
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
  private rows: Row[];
  private pendingInsert: Row[] | null = null;
  private pendingUpdate: Row | null = null;
  private selectedCols: string | null = null;
  private limitN: number | null = null;
  private orderBy: { col: string; desc: boolean } | null = null;

  constructor(private store: MockStore, private tableName: string) {
    this.rows = store.tables[tableName] ?? [];
  }

  eq(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] === val); return this; }
  neq(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] !== val); return this; }
  not(col: string, op: string, val: any) {
    if (op === 'is' && val === null) {
      this.rows = this.rows.filter((r) => r[col] !== null && r[col] !== undefined);
    } else {
      this.rows = this.rows.filter((r) => r[col] !== val);
    }
    return this;
  }
  lt(col: string, val: any) {
    this.rows = this.rows.filter((r) => new Date(r[col]).getTime() < new Date(val).getTime());
    return this;
  }
  lte(col: string, val: any) {
    this.rows = this.rows.filter((r) => new Date(r[col]).getTime() <= new Date(val).getTime());
    return this;
  }
  gt(col: string, val: any) {
    this.rows = this.rows.filter((r) => new Date(r[col]).getTime() > new Date(val).getTime());
    return this;
  }
  gte(col: string, val: any) {
    this.rows = this.rows.filter((r) => new Date(r[col]).getTime() >= new Date(val).getTime());
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
    if (this.pendingUpdate) {
      for (const r of this.rows) Object.assign(r, this.pendingUpdate);
      return { data: this.project(this.rows), error: null };
    }
    return { data: this.project(this.compute()), error: null };
  }

  private compute(): Row[] {
    let rows = [...this.rows];
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
    return rows;
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

/** The exact GHL API v2 webhook envelope from finding F-1. */
const GHL_V2_INVOICE_PAID = {
  type: 'InvoicePaid',
  locationId: 'loc1',
  data: {
    contact: { id: 'contact-b', email: B_EMAIL },
    invoice: { id: 'inv-1', status: 'paid', amount: 49, currency: 'USD' },
  },
};

function postV2Envelope(envelope: unknown): NextRequest {
  return new NextRequest('https://example.com/api/webhooks/ghl', {
    method: 'POST',
    body: JSON.stringify(envelope),
    headers: { 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// F1-a — BEFORE: the raw v2 envelope has no top-level `event`/`email`.
// The old route validated the raw body, so this exact envelope got HTTP 400.
// ---------------------------------------------------------------------------
function verifyBeforeDefect() {
  const raw = GHL_V2_INVOICE_PAID as Record<string, any>;
  assert.equal(raw.event, undefined, 'raw v2 envelope has NO top-level event (old route 400: Missing event type)');
  assert.equal(raw.email, undefined, 'raw v2 envelope has NO top-level email (old route 400: Missing email)');
  assert.equal(raw.type, 'InvoicePaid', 'v2 event name lives in `type`');
  assert.equal(raw.data.contact.email, B_EMAIL, 'email lives nested under data.contact.email');

  // Sanity: the adapter maps it correctly when it is allowed to run.
  const normalized = normalizeGHLEvent(raw);
  assert.equal(normalized.event, 'payment.success', 'normalizeGHLEvent maps InvoicePaid -> payment.success');
  assert.equal(normalized.email, B_EMAIL, 'normalizeGHLEvent lifts nested contact email');

  console.log('  [F1-a] BEFORE — raw v2 envelope rejected by old boundary validation (documented): PASS');
}

// ---------------------------------------------------------------------------
// F1-b — AFTER: POST the real v2 envelope through the REAL route handler.
// Expect HTTP 200 AND a release ledger row (the lifecycle actually ran).
// ---------------------------------------------------------------------------
async function verifyAfterRouteAcceptsV2() {
  const { store, client } = freshClient(
    seedBase([
      // Bella attributed to Alice 31 days ago, still pending — the moment a GHL
      // payment arrives, the release sweep inside the route can release it.
      {
        user_id: 'uid-bella',
        email: B_EMAIL,
        status: 'active',
      },
    ])
  );

  const referral = {
    id: 'ref-bella-1',
    referrer_user_id: 'uid-alice',
    referred_email: B_EMAIL,
    referred_user_id: 'uid-bella',
    status: 'pending',
    created_at: daysFrom(new Date(), -(REFERRAL_HOLD_DAYS + 1)).toISOString(),
  };
  store.tables.referrals.push(referral);

  const res = await handleGHLEvent(postV2Envelope(GHL_V2_INVOICE_PAID), webhookDeps(client));

  assert.equal(res.status, 200, `route returns HTTP 200 for real GHL v2 envelope (got ${res.status})`);
  const body = await res.json();
  assert.equal(body.error, undefined, 'response carries no error');
  assert.equal(body.message, 'Event processed successfully', 'response confirms processing');

  // The release/ledger path ran inside the route: referral confirmed + released.
  const confirmed = store.tables.referrals.find((r) => r.referred_email === B_EMAIL)!;
  assert.equal(confirmed.status, 'released', 'referral moved pending -> released via route');
  assert.ok(confirmed.paid_at, 'payment confirmation stamped (paid_at set)');
  assert.ok(confirmed.released_at, 'released_at stamped');

  const ledger = store.tables.referral_credits.filter((c) => c.referral_id === confirmed.id);
  assert.equal(ledger.length, 1, 'a release ledger row was created');
  assert.equal(ledger[0].referral_id, 'ref-bella-1', 'ledger row references the released referral');
  assert.equal(ledger[0].kind, 'release', 'ledger kind is release');
  assert.equal(ledger[0].status, 'earned', 'ledger status is earned');
  assert.equal(ledger[0].referrer_user_id, 'uid-alice', 'ledger credits the referrer');
  assert.equal(Number(ledger[0].amount), REFERRAL_CREDIT_AMOUNT, 'ledger amount matches credit');

  console.log('  [F1-b] AFTER — route accepts GHL v2 envelope -> HTTP 200 + release ledger row: PASS');
}

// ---------------------------------------------------------------------------
// F1-c — legacy flat v1 path still works end-to-end through the route.
// ---------------------------------------------------------------------------
async function verifyFlatV1PathStillWorks() {
  const { store, client } = freshClient(seedBase());

  // C signs up through Alice's link (normal path, recent timestamp).
  const attr = await recordAttribution(client, {
    code: A_CODE,
    referredEmail: 'cara@example.com',
    referredUserId: 'uid-cara',
  });
  assert.equal(attr.ok, true, 'attribution succeeds');

  // Flat v1 payload: top-level `event` + `email`, as the handler originally used.
  const res = await handleGHLEvent(
    postV2Envelope({
      event: 'payment.success',
      email: 'cara@example.com',
      contact_id: 'contact-c',
      amount: 49,
      product_name: 'Coach Cass AI',
    }),
    webhookDeps(client)
  );

  assert.equal(res.status, 200, `flat v1 payload still returns HTTP 200 (got ${res.status})`);
  const body = await res.json();
  assert.equal(body.error, undefined, 'no error on flat v1 payload');

  // Confirmation stamped — v1 path not regressed.
  const confirmed = store.tables.referrals.find((r) => r.referred_email === 'cara@example.com')!;
  assert.equal(confirmed.status, 'pending', 'still pending (hold not elapsed) — no release, as expected');
  assert.ok(confirmed.paid_at, 'flat v1 payment event stamped paid_at');
  assert.equal(Number(confirmed.credit_amount), REFERRAL_CREDIT_AMOUNT, 'credit amount recorded');

  // And the lifecycle is fully intact: after the hold elapses a release ledger row appears.
  const { released } = await releaseEligibleReferrals(
    client,
    daysFrom(new Date(confirmed.created_at), REFERRAL_HOLD_DAYS + 1)
  );
  assert.equal(released, 1, 'release sweep still works for flat v1 path');
  const releasedRow = store.tables.referrals.find((r) => r.referred_email === 'cara@example.com')!;
  assert.equal(releasedRow.status, 'released', 'referral released after hold');
  const ledger = store.tables.referral_credits.filter((c) => c.referral_id === releasedRow.id);
  assert.equal(ledger.length, 1, 'release ledger row written for flat v1 path');
  assert.equal(ledger[0].kind, 'release', 'ledger kind is release');

  console.log('  [F1-c] legacy flat v1 path still works through the route: PASS');
}

// ---------------------------------------------------------------------------
// Also re-run the lifecycle direct-dispatch prove (V4 adapter + happy path) to
// confirm nothing else regressed. Deferred until after the route checks.
// ---------------------------------------------------------------------------
async function verifyAdapterStillMaps() {
  const tagAdded = normalizeGHLEvent({
    type: 'ContactTagUpdate',
    data: { contactId: 'contact-b', action: 'added', tag: { name: 'Coach Cass AI Subscriber' } },
  });
  assert.equal(tagAdded.event, 'contact.tagged', 'ContactTagUpdate/added maps to contact.tagged');

  const cancelled = normalizeGHLEvent({
    type: 'OrderStatusUpdate',
    data: { order: { id: 'o1', status: 'cancelled' } },
  });
  assert.equal(cancelled.event, 'payment.failed', 'OrderStatusUpdate/cancelled maps to payment.failed');

  const completed = normalizeGHLEvent({
    type: 'OrderStatusUpdate',
    data: { order: { id: 'o2', status: 'completed' } },
  });
  assert.equal(completed.event, 'payment.success', 'OrderStatusUpdate/completed maps to payment.success');

  const voided = normalizeGHLEvent({ type: 'InvoiceVoid', data: { invoice: { id: 'inv-2', status: 'void' } } });
  assert.equal(voided.event, 'payment.failed', 'InvoiceVoid maps to payment.failed');

  // confirmReferralPayment + releaseEligibleReferrals still compose (no regression).
  const { store, client } = freshClient(seedBase());
  await recordAttribution(client, { code: A_CODE, referredEmail: 'dana@example.com', referredUserId: 'uid-dana' });
  await confirmReferralPayment(client, 'dana@example.com', { amount: 49, eventType: 'payment.success' });
  const dana = store.tables.referrals.find((r) => r.referred_email === 'dana@example.com')!;
  const { released } = await releaseEligibleReferrals(client, daysFrom(new Date(dana.created_at), REFERRAL_HOLD_DAYS + 1));
  assert.equal(released, 1, 'direct lifecycle release still works');

  console.log('  [F1-d] GHL v2 adapter mappings + direct lifecycle: PASS');
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('\nCC-04 F-1 prove — GHL v2 webhook envelope reaches the route lifecycle\n');
  verifyBeforeDefect();
  await verifyAfterRouteAcceptsV2();
  await verifyFlatV1PathStillWorks();
  await verifyAdapterStillMaps();
  console.log('\nALL ASSERTIONS PASSED — CC-04 F-1 route accepts real GHL v2 envelopes and the release ledger runs.');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
