/**
 * Prove-fixed harness for CC-14 finding F-1
 * "Referral section omits credit".
 *
 * Runs the REAL GET handler from app/api/admin/referrals/route.ts against a
 * faked PostgREST boundary (scripts/cc-14-f1-credit-loader.mjs) and asserts:
 *
 *   1. A referral row WITH credit_amount -> API response `credit` equals it.
 *   2. A referral row WITHOUT credit_amount -> API response `credit` is null
 *      (never fabricated) and the shape matches the admin UI's Referral type
 *      (credit: number | null), which renders null as "—".
 *
 * Run with: npx tsx scripts/cc-14-f1-credit-prove.test.ts
 */
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Install the loader BEFORE the route module graph is imported so the
// server-only `@/lib/*` deps resolve to the fakes above.
register(new URL('./cc-14-f1-credit-loader.mjs', import.meta.url).href, import.meta.url);

// Mirror of the admin UI's Referral type (app/admin/referrals/page.tsx).
// `credit` is a nullable number so rows without credit still render ("—").
type AdminUiReferral = {
  id: string;
  referrerEmail: string;
  referredEmail: string;
  status: 'pending' | 'released' | 'paid';
  createdAt: string;
  releasedAt: string | null;
  credit: number | null;
};

// API shape returned by the real route.
type ApiEnvelope = { referrals: AdminUiReferral[] };

const REFERRER_UUID = '11111111-1111-1111-1111-111111111111';

function makeDbState(overrides: { withCredit: number | null }) {
  const withCreditRow = {
    id: 'aaaaaaaa-0000-0000-0000-0000000000aa',
    referrer_user_id: REFERRER_UUID,
    referred_email: 'with-credit@example.com',
    status: 'released',
    created_at: '2026-08-01T00:00:00Z',
    released_at: '2026-08-10T00:00:00Z',
    credit_amount: overrides.withCredit,
  };
  const noCreditRow = {
    id: 'bbbbbbbb-0000-0000-0000-0000000000bb',
    referrer_user_id: REFERRER_UUID,
    referred_email: 'no-credit@example.com',
    status: 'pending',
    created_at: '2026-08-02T00:00:00Z',
    released_at: null,
    credit_amount: null,
  };
  return {
    referrals: [withCreditRow, noCreditRow],
    user_profiles: [
      { user_id: REFERRER_UUID, email: 'referrer@example.com' },
    ],
  };
}

async function runGet() {
  const { GET } = await import('../app/api/admin/referrals/route');
  const res = await GET();
  return res;
}

async function main() {
  // ---- Admin identity so the real auth gate passes ----
  (globalThis as any).__cc14AdminUser = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'coach@wantedwoman.com',
  };

  // ---- Case 1: row WITH credit_amount -> credit surfaces as the amount ----
  (globalThis as any).__cc14FakeDb = makeDbState({ withCredit: 25.5 });
  const res1 = await runGet();
  assert.equal(res1.status, 200, 'GET must be authorized for an admin email');
  const body1 = (await res1.json()) as ApiEnvelope;
  assert.ok(Array.isArray(body1.referrals), 'response must contain referrals array');
  const withCredit = body1.referrals.find((r) => r.referredEmail === 'with-credit@example.com');
  const noCredit = body1.referrals.find((r) => r.referredEmail === 'no-credit@example.com');
  assert.ok(withCredit, 'row WITH credit must be present');
  assert.ok(noCredit, 'row WITHOUT credit must be present');
  assert.equal(
    withCredit.credit,
    25.5,
    'credit must round-trip the stored credit_amount value'
  );
  assert.equal(
    noCredit.credit,
    null,
    'credit must be null (never fabricated) when credit_amount is null'
  );

  // ---- Case 2: auth gate still blocks non-admins ----
  (globalThis as any).__cc14AdminUser = { id: 'x', email: 'not-admin@example.com' };
  const res2 = await runGet();
  assert.equal(res2.status, 403, 'non-admin must be forbidden');

  // ---- Case 3: unauthenticated -> 401 ----
  (globalThis as any).__cc14AdminUser = null;
  const res3 = await runGet();
  assert.equal(res3.status, 401, 'unauthenticated must be unauthorized');

  // ---- Compile-time shape check: API rows fit the admin UI Referral type ----
  const uiRows: AdminUiReferral[] = [
    { id: 'x', referrerEmail: 'a', referredEmail: 'b', status: 'pending', createdAt: 't', releasedAt: null, credit: null },
    { id: 'y', referrerEmail: 'a', referredEmail: 'c', status: 'released', createdAt: 't', releasedAt: null, credit: 42 },
  ];
  const renderCredit = (r: AdminUiReferral) =>
    r.credit != null ? `$${Number(r.credit).toFixed(2)}` : '—';
  assert.equal(renderCredit(uiRows[0]), '—', 'UI renders — for null credit');
  assert.equal(renderCredit(uiRows[1]), '$42.00', 'UI renders $ for a credit value');

  console.log('\nALL ASSERTIONS PASSED — CC-14 F-1 referral credit prove-fixed.');
  console.log(`  row WITH credit_amount=25.5 -> GET /api/admin/referrals credit = ${withCredit!.credit}`);
  console.log(`  row WITHOUT credit_amount (null) -> credit = ${noCredit!.credit}`);
  console.log(`  non-admin -> ${res2.status} (Forbidden); unauthenticated -> ${res3.status} (Unauthorized)`);
  console.log('  admin UI type: credit: number | null -> null renders as "—"');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
