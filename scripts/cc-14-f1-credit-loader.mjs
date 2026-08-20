// CC-14 F-1 prove-fixed harness loader.
//
// Intercepts the three server-only dependencies of
// app/api/admin/referrals/route.ts so the real GET handler can be executed
// under `npx tsx` (which cannot transform `next/headers` outside a Next
// request scope). The route, auth gate, enrichment, and select list are all
// the REAL code — only the network boundary is faked via globalThis state
// that scripts/cc-14-f1-credit-prove.test.ts populates.
//
// Run with: npx tsx scripts/cc-14-f1-credit-prove.test.ts

const MOCK_URL_PREFIX = 'mock://cc14/';

// The route imports these bare specifiers. tsx's own loader runs first and
// resolves them to file URLs, which it then hands to this loader — so we
// match BOTH the bare specifier and the resolved repo-relative file path.
const SPECIFIER_TO_URL = new Map([
  ['@/lib/supabase/server', MOCK_URL_PREFIX + 'supabase-server'],
  ['@/lib/auth/auto-provision', MOCK_URL_PREFIX + 'auto-provision'],
  ['@/lib/config/admin', MOCK_URL_PREFIX + 'config-admin'],
]);

const REPO_ROOT = new URL('../', import.meta.url).href; // file://.../scripts/../
const FILE_PATH_TO_URL = new Map([
  ['lib/supabase/server.ts', MOCK_URL_PREFIX + 'supabase-server'],
  ['lib/auth/auto-provision.ts', MOCK_URL_PREFIX + 'auto-provision'],
  ['lib/config/admin.ts', MOCK_URL_PREFIX + 'config-admin'],
]);

const SUPABASE_SERVER_SOURCE = `
// Fake auth: returns the admin user the harness installed, or null (unauth).
export async function getAuthenticatedUser() {
  return globalThis.__cc14AdminUser ?? null;
}
export async function createServerSupabaseClient() {
  throw new Error('createServerSupabaseClient is not used by the CC-14 harness');
}
`;

const AUTO_PROVISION_SOURCE = `
// Apply the requested select() column list to a row, like PostgREST would.
function project(row, columns) {
  if (!columns) return row;
  const out = {};
  for (const c of columns) out[c] = row[c];
  return out;
}

function makeBuilder(table) {
  const b = {
    _select: null,
    select(cols) {
      b._select = cols.split(',').map((c) => c.trim()).filter(Boolean);
      return b;
    },
    order() { return b; },
    limit() { return b; },
    in() { return b; },
    eq() { return b; },
    single() {
      const rows = (globalThis.__cc14FakeDb?.[table] ?? []).slice();
      const first = rows[0] ?? null;
      return Promise.resolve(first
        ? { data: project(first, b._select), error: null }
        : { data: null, error: { message: 'not found' } });
    },
    then(resolve) {
      const rows = (globalThis.__cc14FakeDb?.[table] ?? []).slice();
      const selected = b._select ? rows.map((r) => project(r, b._select)) : rows;
      resolve({ data: selected, error: null });
    },
  };
  return b;
}

// Fake PostgREST client shaped like the real @supabase/supabase-js one.
export function createServiceRoleClient() {
  return {
    from(table) {
      return makeBuilder(table);
    },
  };
}
`;

const CONFIG_ADMIN_SOURCE = `
export const ADMIN_EMAILS = ['coach@wantedwoman.com'];
`;

export async function resolve(specifier, context, nextResolve) {
  const direct = SPECIFIER_TO_URL.get(specifier);
  if (direct) {
    return { url: direct, shortCircuit: true };
  }
  if (typeof specifier === 'string' && specifier.startsWith('file:')) {
    const url = new URL(specifier);
    if (url.href.startsWith(REPO_ROOT)) {
      const rel = url.href.slice(REPO_ROOT.length);
      const mockUrl = FILE_PATH_TO_URL.get(rel);
      if (mockUrl) {
        return { url: mockUrl, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(MOCK_URL_PREFIX)) {
    let source;
    if (url === MOCK_URL_PREFIX + 'supabase-server') {
      source = SUPABASE_SERVER_SOURCE;
    } else if (url === MOCK_URL_PREFIX + 'auto-provision') {
      source = AUTO_PROVISION_SOURCE;
    } else if (url === MOCK_URL_PREFIX + 'config-admin') {
      source = CONFIG_ADMIN_SOURCE;
    } else {
      throw new Error('Unknown mock URL: ' + url);
    }
    return { format: 'module', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
