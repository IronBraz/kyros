// Customer-facing endpoints: join the queue, poll your position, stay alive, leave.
// No authentication: a customer's only credential is the session id in their localStorage.
import { Hono } from 'hono';
import { z } from 'zod';
import { clientIp, hashIp } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { Limits, consume } from '../lib/ratelimit.js';
import { ErrorCode, fail, ok } from '../lib/respond.js';

const client = new Hono();

const uuid = z.string().uuid();

// POST /api/v1/client/sessions -- take a ticket
const createBody = z.object({
  // Accepts either an entry point UUID (?ep=<uuid>) or a slug (/q/<slug>). LandingPage.tsx
  // extracts the slug from /q/:slug and posts it in this field, so both have to work.
  entry_point_id: z.string().min(1).max(100),
  language: z.string().max(5).default('it'),
});

client.post('/sessions', async (c) => {
  const parsed = createBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'Invalid request body', 400, parsed.error.issues);
  }
  const { entry_point_id, language } = parsed.data;

  // Anti-flood. One phone should not be able to fill the board with tickets nobody will
  // claim, which is both a nuisance and a way to make the store look busy when it is not.
  const limited = await consume(
    `session:${hashIp(clientIp(c))}`,
    Limits.createSession.limit,
    Limits.createSession.windowSeconds
  );
  if (!limited.allowed) {
    c.header('Retry-After', String(limited.retryAfterSeconds));
    return fail(c, ErrorCode.RATE_LIMITED, 'Too many requests. Please wait a moment.', 429);
  }

  const sql = db();

  // `ep.id::text = $1 OR ep.slug = $1`: the cast to text is what makes a non-UUID slug safe
  // to compare against a uuid column instead of raising a parse error.
  const entry = (await sql`
    SELECT ep.id, ep.store_id,
           ep.name AS entry_point_name,
           s.name  AS store_name,
           s.timezone,
           s.settings->'queue'->>'accepting_tickets' AS accepting_tickets,
           s.settings->'queue'->>'closed_message'    AS closed_message
      FROM entry_points ep
      JOIN stores s ON s.id = ep.store_id
     WHERE ep.id::text = ${entry_point_id} OR ep.slug = ${entry_point_id}
     LIMIT 1
  `) as Array<Record<string, string>>;

  const ep = entry[0];
  if (!ep) return fail(c, ErrorCode.ENTRY_POINT_NOT_FOUND, 'Invalid entry point', 404);

  // Absent means accepting: a store that has never touched the setting is open.
  if (ep.accepting_tickets === 'false') {
    return fail(
      c,
      ErrorCode.QUEUE_CLOSED,
      ep.closed_message || "We're not accepting new customers at the moment.",
      409,
      { store_name: ep.store_name }
    );
  }

  // position counts everyone already waiting, so the new ticket is last. Computed in the
  // same statement as the INSERT to avoid a second round trip.
  const created = (await sql`
    INSERT INTO sessions (store_id, entry_point_id, ticket_code, status, language)
    VALUES (${ep.store_id}, ${ep.id}, generate_ticket_code(${ep.store_id}), 'waiting', ${language})
    RETURNING id, ticket_code, status, created_at,
      (SELECT COUNT(*) + 1
         FROM sessions s2
        WHERE s2.store_id = ${ep.store_id}
          AND s2.status = 'waiting'
          AND s2.id <> sessions.id) AS position
  `) as Array<Record<string, unknown>>;

  const row = created[0];
  if (!row) return fail(c, ErrorCode.INTERNAL_ERROR, 'Could not create session', 500);

  return ok(c, {
    session_id: row.id,
    ticket_code: row.ticket_code,
    status: row.status,
    position: Number(row.position),
    store_id: ep.store_id,
    store_name: ep.store_name,
    created_at: row.created_at,
  });
});

// GET /api/v1/client/sessions?session_id= -- used for polling and for recovery after refresh
client.get('/sessions', async (c) => {
  const sessionId = c.req.query('session_id') ?? c.req.query('id');
  if (!sessionId || !uuid.safeParse(sessionId).success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'session_id must be a uuid', 400);
  }
  const sql = db();

  const rows = (await sql`
    SELECT s.id, s.ticket_code, s.status, s.created_at, s.called_at,
           s.store_id, st.name AS store_name,
           sp.name AS service_point_name,
           COALESCE((st.settings->'queue'->>'avg_service_time_minutes')::int, 5) AS avg_service_time,
           (SELECT COUNT(*)
              FROM sessions
             WHERE store_id = s.store_id
               AND status = 'waiting'
               AND created_at < s.created_at) + 1 AS position,
           (SELECT COUNT(*)
              FROM sessions
             WHERE store_id = s.store_id
               AND status = 'waiting') AS total_waiting
      FROM sessions s
      JOIN stores st ON st.id = s.store_id
      LEFT JOIN service_points sp ON sp.id = s.service_point_id
     WHERE s.id = ${sessionId}
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) return fail(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);

  // position and the estimate are meaningless once you have been called: null tells the
  // WaitingRoom to switch to the "it's your turn" screen instead of showing "position 1".
  const waiting = row.status === 'waiting';
  const position = Number(row.position);
  const avgServiceTime = Number(row.avg_service_time) || 5;

  return ok(c, {
    session_id: row.id,
    ticket_code: row.ticket_code,
    status: row.status,
    position: waiting ? position : null,
    total_waiting: Number(row.total_waiting),
    estimated_wait_minutes: waiting ? position * avgServiceTime : null,
    store_id: row.store_id,
    store_name: row.store_name,
    service_point_name: row.service_point_name,
    created_at: row.created_at,
    called_at: row.called_at,
  });
});

// POST /api/v1/client/sessions/heartbeat -- "I am still here", every 60s from the phone
const sessionBody = z.object({ session_id: uuid });

client.post('/sessions/heartbeat', async (c) => {
  const parsed = sessionBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'session_id must be a uuid', 400);
  }
  const sql = db();

  // The status filter is what makes this idempotent and harmless: a phone that keeps beating
  // after the customer was served cannot resurrect a finished session.
  const rows = (await sql`
    UPDATE sessions
       SET last_seen_at = NOW()
     WHERE id = ${parsed.data.session_id}
       AND status IN ('waiting', 'called')
    RETURNING id, status, last_seen_at
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) {
    return fail(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found or already completed', 404);
  }
  return ok(c, { status: row.status, last_seen_at: row.last_seen_at });
});

// POST /api/v1/client/sessions/abandon -- customer taps "leave the queue"
client.post('/sessions/abandon', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = body.session_id ?? c.req.query('session_id');
  if (!uuid.safeParse(sessionId).success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'session_id must be a uuid', 400);
  }
  const sql = db();

  const rows = (await sql`
    UPDATE sessions
       SET status = 'abandoned', finished_at = NOW()
     WHERE id = ${sessionId as string}
       AND status IN ('waiting', 'called')
    RETURNING id, ticket_code, status, finished_at
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) {
    return fail(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found or already completed', 404);
  }
  return ok(c, {
    session_id: row.id,
    ticket_code: row.ticket_code,
    status: row.status,
    finished_at: row.finished_at,
  });
});

// GET /api/v1/client/marketing-cards?store_id= -- the waiting-room content feed
client.get('/marketing-cards', async (c) => {
  const storeId = c.req.query('store_id');
  if (!storeId || !uuid.safeParse(storeId).success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'store_id must be a uuid', 400);
  }
  const sql = db();

  // A card with store_id NULL is brand-wide, but only inside its own tenant -- hence the
  // tenant_id subquery. Without it a GLOBAL card would surface in every store of every
  // tenant sharing the database.
  const cards = (await sql`
    SELECT id, type, title, content, theme_color, icon_name, action_url, priority
      FROM marketing_cards
     WHERE (store_id = ${storeId}
            OR (store_id IS NULL
                AND tenant_id = (SELECT tenant_id FROM stores WHERE id = ${storeId})))
       AND is_active = true
       AND (valid_from IS NULL OR valid_from <= NOW())
       AND (valid_to   IS NULL OR valid_to   >= NOW())
     ORDER BY priority DESC, created_at DESC
     LIMIT 10
  `) as Array<Record<string, unknown>>;

  // `icon` and `theme`, not `iconName`/`themeColor`. This endpoint used to send the latter
  // pair while WaitingRoom spread the response straight into <MarketingCard {...card} />,
  // which destructures `icon` and `theme`. Both were therefore always undefined and every
  // card in the waiting room fell back to the Info icon on the blue theme, whatever the
  // store had configured. Nothing ever read the camelCase names -- grep for iconName in
  // pwa/src returns nothing -- so renaming here is the whole fix, and it also lines the
  // endpoint up with the admin one, which already aliases to icon/theme.
  return ok(c, {
    cards: cards.map((card) => ({
      id: card.id,
      type: card.type,
      title: card.title,
      content: card.content,
      theme: card.theme_color ?? 'blue',
      icon: card.icon_name ?? 'Info',
      actionUrl: card.action_url,
    })),
  });
});

export default client;
