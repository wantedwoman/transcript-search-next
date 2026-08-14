/**
 * Prove-fixed test for CC-09 finding (Correctness 5 / Fidelity 5 / Operational health 5):
 * "console.log -> a real email send to ADMIN_EMAILS (member identity + exact
 *  language + timestamp + 'CONTACT AUTHORITIES IF IMMINENT')."
 *
 * Run with: npx tsx scripts/cc-09-email-prove-fixed.test.ts
 *
 * Mocks global.fetch and asserts the outbound email payload.
 */
import assert from 'node:assert/strict';

// The logger only emits when NODE_ENV is development/production. Set it before
// importing the module graph so lib/config/env.ts picks it up.
(process.env as Record<string, string | undefined>).NODE_ENV = 'development';

const { sendHarmAlertEmail } = await import('../lib/harm/alert-team');
const { ADMIN_EMAILS } = await import('../lib/config/admin');

const SUBJECT = 'HARM ALERT — Coach Cass member in crisis';

const SAMPLE_ALERT = {
  memberEmail: 'member@example.com',
  alertId: 'alert_cc09_1',
  timestamp: '2026-08-13T12:34:56.789Z',
  messageSnippet: 'i want to kill myself today',
  matchedPattern: 'kill myself',
  severity: 'critical' as const,
};

type MockedFetchCall = {
  url: string;
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  };
};

async function main() {
  // ---- Part 1: a real email is sent with the exact required payload ----
  const calls: MockedFetchCall[] = [];
  (globalThis as any).fetch = async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => '{"id":"email_prove_fixed"}' };
  };

  process.env.RESEND_API_KEY = 're_test_prove_fixed';

  await sendHarmAlertEmail(SAMPLE_ALERT);

  assert.equal(calls.length, 1, 'fetch must be called exactly once');
  const call = calls[0];
  assert.equal(call.url, 'https://api.resend.com/emails', 'must POST to the Resend emails endpoint');
  assert.equal(call.init.method, 'POST');
  assert.equal(
    call.init.headers?.['Authorization'],
    'Bearer re_test_prove_fixed',
    'must use the RESEND_API_KEY env value as bearer token'
  );
  assert.match(call.init.headers?.['Content-Type'] ?? '', /application\/json/);
  assert.ok(call.init.signal, 'must pass an abort signal (timeout-bounded)');

  const payload = JSON.parse(call.init.body ?? '{}');
  assert.equal(payload.subject, SUBJECT, 'subject must be the exact required string');
  assert.deepEqual(payload.to, ADMIN_EMAILS, 'to must be the ADMIN_EMAILS recipients');
  assert.ok(payload.from, 'must have a from address');
  assert.ok(payload.text.includes(SAMPLE_ALERT.memberEmail), 'body includes member identity');
  assert.ok(
    payload.text.includes(SAMPLE_ALERT.messageSnippet),
    'body includes the exact harm language'
  );
  assert.ok(payload.text.includes(SAMPLE_ALERT.timestamp), 'body includes the timestamp');
  assert.ok(
    payload.text.includes('CONTACT AUTHORITIES IF IMMINENT'),
    'body includes the next-action instructions'
  );

  // ---- Part 2: no provider key -> never sends, never throws, never logs PII ----
  const logLines: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logLines.push(args.map(String).join(' '));
  };

  let fetchWasCalled = false;
  (globalThis as any).fetch = async () => {
    fetchWasCalled = true;
    return { ok: true, status: 200, text: async () => '' };
  };

  delete process.env.RESEND_API_KEY;
  await sendHarmAlertEmail(SAMPLE_ALERT); // must not throw

  console.error = originalError;

  assert.equal(fetchWasCalled, false, 'must not attempt a network call without a provider key');
  assert.ok(
    logLines.some((l) => l.includes('RESEND_API_KEY is not configured')),
    'must log that the alert could not be emailed (operational visibility)'
  );
  assert.ok(
    logLines.every((l) => !l.includes(SAMPLE_ALERT.messageSnippet)),
    'must NOT log the member message to the server console (PII)'
  );

  // ---- Part 3: provider/network failure must never throw ----
  let threw = false;
  try {
    process.env.RESEND_API_KEY = 're_test_prove_fixed';
    (globalThis as any).fetch = async () => {
      throw new Error('provider down');
    };
    await sendHarmAlertEmail(SAMPLE_ALERT);
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'an email outage must never break the member reply');

  console.log('\nALL ASSERTIONS PASSED — CC-09 email alert prove-fixed.');
  console.log(`  recipient count: ${ADMIN_EMAILS.length}`);
  console.log(`  subject: ${SUBJECT}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
