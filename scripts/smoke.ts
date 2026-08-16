/**
 * End-to-end smoke test. Runs the whole customer and operator journey against a live
 * deployment and exits non-zero on the first failure.
 *
 *   npm run smoke -- https://kyros-xyz.vercel.app
 *   npm run smoke                                    (defaults to http://localhost:3100)
 *
 * Needs KYROS_SMOKE_PIN to exercise the admin half; without it the admin steps are skipped
 * rather than failed, so the client path can still be checked against production without
 * handing a PIN to a script.
 *
 * It cleans up after itself: every session it creates is abandoned or finished by the end.
 */

// Marks the file as a module so top-level await is allowed. It imports nothing on purpose:
// the point is to exercise the deployment over HTTP exactly as a browser would, with no
// shared code that could hide a mismatch between what the server sends and what we assume.
export {};

const BASE = (process.argv[2] ?? process.env.KYROS_SMOKE_URL ?? 'http://localhost:3100').replace(/\/+$/, '');
const PIN = process.env.KYROS_SMOKE_PIN ?? '';
const SLUG = process.env.KYROS_SMOKE_SLUG ?? 'main-entrance';

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  checks++;
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`);
    if (detail !== undefined) console.error(`        ${JSON.stringify(detail).slice(0, 400)}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

interface Envelope<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface Call<T> {
  status: number;
  body: Envelope<T>;
}

// Set once the deployment turns out to be behind Vercel's protection. Every response then
// looks like a 401 from our own code, which would make a completely unreachable deployment
// read as "security checks passing".
let protectionHit = false;

async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {}
): Promise<Call<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['X-Admin-Session'] = opts.token;
  // Set VERCEL_AUTOMATION_BYPASS_SECRET to run against a protected preview.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    body = { success: false, error: { code: 'NOT_JSON', message: await res.text() } };
  }

  if ((body as unknown as { protection?: unknown }).protection !== undefined) {
    protectionHit = true;
  }
  return { status: res.status, body };
}

/** A response is only OK if our own envelope says so. A 200 with success:false is a failure. */
function okBody(r: Call<unknown>): boolean {
  return r.status >= 200 && r.status < 300 && r.body.success === true;
}

/**
 * A refusal is only OK if it is OUR refusal. Vercel's deployment protection also answers
 * 401, so matching on the status alone would let a wall of platform 401s masquerade as
 * working authentication.
 */
function refusedByUs(r: Call<unknown>, ...codes: string[]): boolean {
  if (r.body.success !== false) return false;
  const code = r.body.error?.code;
  if (!code) return false;
  return codes.length === 0 || codes.includes(code);
}

console.log(`Kyros smoke test against ${BASE}`);

// ---------------------------------------------------------------- health

section('health');
const health = await call<{ db_version: string; status: string }>('GET', '/api/v1/health');

// Bail out immediately rather than emit two dozen confusing failures: nothing below can
// mean anything if the platform is intercepting every request before it reaches the app.
if (protectionHit) {
  console.error(`
  Vercel Deployment Protection is enabled on this deployment, so every request is
  intercepted before it reaches Kyros. The smoke test cannot tell your code apart from
  the platform's 401 page.

  Either disable protection for Preview in the project settings, or enable
  "Protection Bypass for Automation" and re-run with:

      $env:VERCEL_AUTOMATION_BYPASS_SECRET = "<secret>"
      npm run smoke -- ${BASE}
`);
  process.exit(2);
}

check('health returns 200', okBody(health), health.body);
check('health reports a database version', Boolean(health.body.data?.db_version), health.body.data);

// ---------------------------------------------------------------- customer journey

section('customer takes a ticket');
const created = await call<{ session_id: string; ticket_code: string; position: number; store_id: string }>(
  'POST',
  '/api/v1/client/sessions',
  { body: { entry_point_id: SLUG, language: 'it' } }
);
check('session created from the QR slug', okBody(created), created.body);

const sessionId = created.body.data?.session_id ?? '';
const storeId = created.body.data?.store_id ?? '';
if (!sessionId || !storeId) {
  console.error('\nCannot continue: no session was created. Everything below depends on it.');
  console.error(JSON.stringify(created.body).slice(0, 500));
  process.exit(1);
}
check('ticket code looks like A-001', /^[A-Z]-\d{3}$/.test(created.body.data?.ticket_code ?? ''), created.body.data);

section('customer polls and stays alive');
const fetched = await call<{ position: number | null; status: string }>(
  'GET',
  `/api/v1/client/sessions?session_id=${sessionId}`
);
check('session is readable back', okBody(fetched), fetched.body);
check('position is a number while waiting', typeof fetched.body.data?.position === 'number', fetched.body.data);

const beat = await call<{ status: string }>('POST', '/api/v1/client/sessions/heartbeat', {
  body: { session_id: sessionId },
});
check('heartbeat accepted', okBody(beat) && beat.body.data?.status === 'waiting', beat.body);

const cards = await call<{ cards: unknown[] }>('GET', `/api/v1/client/marketing-cards?store_id=${storeId}`);
check('marketing cards load', okBody(cards) && Array.isArray(cards.body.data?.cards), cards.body);

section('concierge conversation opens');
const convo = await call<{ conversation_id: string }>('POST', '/api/v1/client/chat/start', {
  body: { session_id: sessionId },
});
check('conversation started', okBody(convo) && Boolean(convo.body.data?.conversation_id), convo.body);
const resumed = await call<{ resumed: boolean; conversation_id: string }>('POST', '/api/v1/client/chat/start', {
  body: { session_id: sessionId },
});
check(
  'reopening resumes the same conversation',
  okBody(resumed) &&
    resumed.body.data?.resumed === true &&
    resumed.body.data?.conversation_id === convo.body.data?.conversation_id,
  resumed.body.data
);

// ---------------------------------------------------------------- security

section('security: admin routes are closed');
// Matching on our own error code, not just the status: Vercel's protection page is also a
// 401, so a status-only assertion would go green on a deployment nobody can even reach.
const noAuth = await call('GET', `/api/v1/admin/queue/status?store_id=${storeId}`);
check(
  'queue/status without a token is refused by adminGuard',
  noAuth.status === 401 && refusedByUs(noAuth, 'UNAUTHORIZED'),
  noAuth.body
);

const publicStores = await call<{ stores: unknown[] }>('GET', '/api/v1/admin/auth/stores');
check('auth/stores stays public', okBody(publicStores) && Array.isArray(publicStores.body.data?.stores), publicStores.body);

const noCron = await call('GET', '/api/internal/cron/daily');
check(
  'internal cron without the secret is refused',
  noCron.status === 401 && refusedByUs(noCron, 'UNAUTHORIZED'),
  noCron.body
);

// ---------------------------------------------------------------- operator journey

let token = '';
if (!PIN) {
  console.log('\n  SKIP  admin journey (set KYROS_SMOKE_PIN to run it)');
} else {
  section('operator logs in');
  const login = await call<{ session_token: string }>('POST', '/api/v1/admin/auth/verify', {
    body: { store_id: storeId, access_code: PIN },
  });
  check('PIN accepted', okBody(login), login.body);
  token = login.body.data?.session_token ?? '';
  check('a signed session token came back', token.includes('.') && token.length > 40);

  const badPin = await call('POST', '/api/v1/admin/auth/verify', {
    body: { store_id: storeId, access_code: '000000' },
  });
  // RATE_LIMITED is also a pass: it means the limiter kicked in, which is the stronger
  // outcome. Anything else, including a platform 401, is a failure.
  check('a wrong PIN is refused', refusedByUs(badPin, 'INVALID_PIN', 'RATE_LIMITED'), badPin.body);

  section('operator sees the board');
  const status = await call<{ waiting: Array<{ ticket_code: string }>; counts: Record<string, number> }>(
    'GET',
    `/api/v1/admin/queue/status?store_id=${storeId}`,
    { token }
  );
  check('board loads with a token', okBody(status), status.body);
  check(
    'our ticket is on the board',
    (status.body.data?.waiting ?? []).some((w) => w.ticket_code === created.body.data?.ticket_code),
    status.body.data?.waiting
  );

  section('IDOR: the store_id parameter must be ignored');
  const otherStore = '00000000-0000-0000-0000-000000000000';
  const idor = await call<{ waiting: Array<{ ticket_code: string }> }>(
    'GET',
    `/api/v1/admin/queue/status?store_id=${otherStore}`,
    { token }
  );
  // Asking for a store that does not exist must still answer with OUR store, not 404,
  // because the parameter is discarded before it reaches the query. Comparing the payload
  // rather than just the status: an empty 200 would also pass a status-only check.
  check(
    'asking for another store returns our own board',
    okBody(idor) &&
      JSON.stringify(idor.body.data?.waiting) === JSON.stringify(status.body.data?.waiting),
    { asked: otherStore, got: idor.body.data?.waiting }
  );

  section('concurrency: two tills call at once');
  // Second customer, so there are two to hand out.
  const second = await call<{ session_id: string; ticket_code: string }>('POST', '/api/v1/client/sessions', {
    body: { entry_point_id: SLUG },
  });
  const secondId = second.body.data?.session_id ?? '';

  const [a, b] = await Promise.all([
    call<{ ticket_code: string }>('POST', '/api/v1/admin/queue/call-next', { body: { store_id: storeId }, token }),
    call<{ ticket_code: string }>('POST', '/api/v1/admin/queue/call-next', { body: { store_id: storeId }, token }),
  ]);
  const ticketA = a.body.data?.ticket_code;
  const ticketB = b.body.data?.ticket_code;
  check('both calls returned a ticket', okBody(a) && okBody(b) && Boolean(ticketA) && Boolean(ticketB), {
    a: a.body,
    b: b.body,
  });
  // The whole point of FOR UPDATE SKIP LOCKED: never the same customer twice. Guarded on
  // both being present, otherwise two undefineds would compare unequal and pass.
  check(
    'the two tickets are different',
    Boolean(ticketA) && Boolean(ticketB) && ticketA !== ticketB,
    { ticketA, ticketB }
  );

  section('operator closes the visits');
  for (const id of [sessionId, secondId].filter(Boolean)) {
    const done = await call<{ status: string }>('PATCH', '/api/v1/admin/sessions/status', {
      body: { session_id: id, status: 'finished' },
      token,
    });
    check(
      `session ${id.slice(0, 8)} marked finished`,
      okBody(done) && done.body.data?.status === 'finished',
      done.body
    );
  }

  section('settings survive a partial save');
  const before = await call<{ settings: { queue: Record<string, unknown> } }>(
    'GET',
    `/api/v1/admin/stores/settings?store_id=${storeId}`,
    { token }
  );
  check('settings are readable', okBody(before), before.body);
  const closedMessage = before.body.data?.settings?.queue?.closed_message;
  const patched = await call('PATCH', `/api/v1/admin/stores/settings?store_id=${storeId}`, {
    body: { queue: { accepting_tickets: true } },
    token,
  });
  check('partial settings save accepted', okBody(patched), patched.body);

  const after = await call<{ settings: { queue: Record<string, unknown> } }>(
    'GET',
    `/api/v1/admin/stores/settings?store_id=${storeId}`,
    { token }
  );
  // The n8n shallow merge wiped every sibling key here. Requiring the value to be a real
  // string as well, so two undefineds cannot quietly match.
  check(
    'saving one field keeps its siblings',
    okBody(after) &&
      typeof closedMessage === 'string' &&
      after.body.data?.settings?.queue?.closed_message === closedMessage,
    after.body.data?.settings?.queue
  );

  section('wiki is bundled');
  const wiki = await call<{ wiki_version: string; file_count: number }>('POST', '/api/v1/admin/wiki/reload', {
    body: { store_id: storeId },
    token,
  });
  check('wiki reports a version', okBody(wiki) && Boolean(wiki.body.data?.wiki_version), wiki.body.data);
  check('wiki has pages', okBody(wiki) && (wiki.body.data?.file_count ?? 0) > 0, wiki.body.data);

  section('AI budget is readable');
  const usage = await call<{ cap_eur: number }>('GET', `/api/v1/admin/usage?store_id=${storeId}`, { token });
  check('usage returns the cap', okBody(usage) && typeof usage.body.data?.cap_eur === 'number', usage.body.data);
}

// ---------------------------------------------------------------- cleanup

section('cleanup');
if (!token && sessionId) {
  // No admin token, so close the session from the customer side instead.
  const left = await call('POST', '/api/v1/client/sessions/abandon', { body: { session_id: sessionId } });
  check('test session abandoned', left.status === 200 || left.status === 404, left.body);
} else {
  console.log('  sessions already closed by the operator steps');
}

// ---------------------------------------------------------------- verdict

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
console.log('smoke test green');
