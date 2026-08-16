// Control Room endpoints. Sixteen of them.
import { waitUntil } from '@vercel/functions';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  adminGuard,
  clientIp,
  hashIp,
  mintToken,
  sessionStoreId,
  sessionTenantId,
} from '../lib/auth.js';
import { config } from '../lib/config.js';
import { db } from '../lib/db.js';
import { sweepIfDue } from '../lib/janitor.js';
import { summarizeConversation } from '../lib/openrouter.js';
import { verifyPin } from '../lib/pin.js';
import { Limits, consume } from '../lib/ratelimit.js';
import { ErrorCode, fail, ok } from '../lib/respond.js';
import { deepMerge, withDefaults } from '../lib/settings.js';
import { loadWiki } from '../lib/wiki.js';

const admin = new Hono();

const uuid = z.string().uuid();

/**
 * The single place a request's store scope is decided, and the reason the IDOR is closed.
 *
 * It reads the store from the SIGNED SESSION TOKEN and never from the query string or body.
 * The frontend still sends ?store_id=... on most calls; the server ignores it. That means
 * the old `GET /admin/queue/status?store_id=<someone else's uuid>` now returns the caller's
 * own store, not the one they asked for, and no frontend change was needed to fix it.
 */
function requireStore(c: Context): string {
  return sessionStoreId(c);
}

// ---------------------------------------------------------------- auth (public)

// GET /api/v1/admin/auth/stores -- populates the store picker on the login screen
admin.get('/auth/stores', async (c) => {
  const sql = db();
  const stores = (await sql`SELECT id, name FROM stores ORDER BY name`) as Array<{
    id: string;
    name: string;
  }>;
  return ok(c, { stores });
});

// POST /api/v1/admin/auth/verify -- PIN login
admin.post('/auth/verify', async (c) => {
  const parsed = z
    .object({ store_id: uuid, access_code: z.string().min(1).max(64) })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'store_id and access_code are required', 400);
  }
  const { store_id, access_code } = parsed.data;
  const sql = db();

  // Throttle before touching the database with the guess. 10 tries per 15 minutes per
  // (store, ip): a 4-digit PIN is 10,000 combinations, which under n8n could be walked
  // through as fast as the network allowed.
  const bucket = `pin:${store_id}:${hashIp(clientIp(c))}`;
  const limited = await consume(bucket, Limits.adminLogin.limit, Limits.adminLogin.windowSeconds);
  if (!limited.allowed) {
    c.header('Retry-After', String(limited.retryAfterSeconds));
    return fail(c, ErrorCode.RATE_LIMITED, 'Too many attempts. Try again later.', 429);
  }

  const stores = (await sql`
    SELECT id, name, tenant_id FROM stores WHERE id = ${store_id} LIMIT 1
  `) as Array<{ id: string; name: string; tenant_id: string }>;

  const store = stores[0];
  if (!store) return fail(c, ErrorCode.STORE_NOT_FOUND, 'Store not found', 404);

  // Hashed PINs cannot be looked up with `WHERE access_code = $2` the way the n8n workflow
  // did. Fetch the store's active codes -- there are one or two -- and verify each.
  const codes = (await sql`
    SELECT id, label, access_code_hash
      FROM admin_access
     WHERE store_id = ${store_id} AND is_active = true
  `) as Array<{ id: string; label: string; access_code_hash: string }>;

  let matched: { id: string; label: string } | null = null;
  for (const row of codes) {
    if (await verifyPin(access_code, row.access_code_hash)) {
      matched = { id: row.id, label: row.label };
      break;
    }
  }

  if (!matched) return fail(c, ErrorCode.INVALID_PIN, 'Invalid access code', 401);

  await sql`UPDATE admin_access SET last_used_at = NOW() WHERE id = ${matched.id}`;

  // The token carries the store and tenant and is HMAC-signed, so every later request is
  // scoped by something the client cannot rewrite. Under n8n this was an unsigned UUID that
  // nothing ever checked.
  const { token, expiresAt } = mintToken({ aid: matched.id, sid: store.id, tid: store.tenant_id });

  return ok(c, {
    session_token: token,
    store_id: store.id,
    store_name: store.name,
    label: matched.label,
    expires_at: expiresAt.toISOString(),
  });
});

// Everything below this line requires a valid X-Admin-Session header. The two routes above
// are the only public ones, and they are declared before the guard on purpose.
admin.use('*', adminGuard);

// ---------------------------------------------------------------- queue

// GET /api/v1/admin/queue/status -- the Control Room board, polled every 2-5 seconds
admin.get('/queue/status', async (c) => {
  const id = requireStore(c);
  const sql = db();

  // The lazy janitor. Runs after the response is sent, and only if a minute has passed, so
  // the poll never waits on it.
  waitUntil(
    sweepIfDue().catch((err) => console.error('[kyros] lazy janitor failed', err))
  );

  const rows = (await sql`
    SELECT
      s.id, s.name,
      s.settings->'queue'->>'accepting_tickets' AS accepting_tickets,
      COALESCE((s.settings->'queue'->>'avg_service_time_minutes')::int, 5) AS avg_service_time,
      (SELECT json_agg(w ORDER BY w.position)
         FROM (SELECT sess.id, sess.ticket_code, sess.status, sess.created_at, sess.called_at,
                      sess.served_at, ep.name AS entry_point_name,
                      ROW_NUMBER() OVER (ORDER BY sess.created_at) AS position
                 FROM sessions sess
                 LEFT JOIN entry_points ep ON ep.id = sess.entry_point_id
                WHERE sess.store_id = s.id AND sess.status = 'waiting') w) AS waiting_sessions,
      (SELECT json_agg(json_build_object(
                'id', sess.id,
                'ticket_code', sess.ticket_code,
                'status', sess.status,
                'called_at', sess.called_at,
                'served_at', sess.served_at,
                'entry_point_name', ep.name,
                'ai_summary', CASE
                  WHEN ai_s.status IS NULL THEN json_build_object('status', 'pending')
                  ELSE json_build_object('status', ai_s.status, 'summary', ai_s.summary,
                                         'sentiment', ai_s.sentiment, 'flags', ai_s.flags)
                END
              ) ORDER BY sess.called_at DESC)
         FROM sessions sess
         LEFT JOIN entry_points ep ON ep.id = sess.entry_point_id
         LEFT JOIN ai_summaries ai_s ON ai_s.conversation_id = sess.ai_conversation_id
        WHERE sess.store_id = s.id AND sess.status IN ('called', 'serving')) AS called_sessions,
      (SELECT json_agg(sub)
         FROM (SELECT sess.id, sess.ticket_code, sess.status, sess.called_at,
                      ep.name AS entry_point_name
                 FROM sessions sess
                 LEFT JOIN entry_points ep ON ep.id = sess.entry_point_id
                WHERE sess.store_id = s.id AND sess.status = 'missed'
                  AND sess.created_at >= store_today(s.id)::timestamp AT TIME ZONE s.timezone
                ORDER BY sess.called_at DESC
                LIMIT 10) sub) AS missed_sessions,
      (SELECT COUNT(*) FROM sessions sess
        WHERE sess.store_id = s.id AND sess.status = 'finished'
          AND sess.created_at >= store_today(s.id)::timestamp AT TIME ZONE s.timezone) AS served_count,
      (SELECT COUNT(*) FROM sessions sess
        WHERE sess.store_id = s.id AND sess.status = 'missed'
          AND sess.created_at >= store_today(s.id)::timestamp AT TIME ZONE s.timezone) AS missed_count
    FROM stores s
   WHERE s.id = ${id}
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) return fail(c, ErrorCode.STORE_NOT_FOUND, 'Store not found', 404);

  const waiting = (row.waiting_sessions as unknown[] | null) ?? [];
  const called = (row.called_sessions as unknown[] | null) ?? [];
  const missed = (row.missed_sessions as unknown[] | null) ?? [];
  const avgServiceTime = Number(row.avg_service_time) || 5;

  return ok(c, {
    accepting_tickets: row.accepting_tickets !== 'false',
    waiting,
    called,
    missed,
    counts: {
      waiting: waiting.length,
      called: called.length,
      missed: Number(row.missed_count) || 0,
      served: Number(row.served_count) || 0,
    },
    avg_service_time: avgServiceTime,
    // Not a measured average: queue length times the configured service time. Same estimate
    // the n8n board showed, kept so the number does not change under the operators' feet.
    avg_wait_minutes: waiting.length * avgServiceTime,
  });
});

// GET /api/v1/admin/queue/current -- flat queue list. The PWA never calls it; kept because
// it is a documented endpoint and costs nothing.
admin.get('/queue/current', async (c) => {
  const id = requireStore(c);
  const sql = db();

  const queue = (await sql`
    SELECT s.id, s.ticket_code, s.status, s.created_at, s.called_at, s.service_point_id,
           sp.name AS service_point_name,
           ep.name AS entry_point_name,
           EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 60 AS wait_minutes
      FROM sessions s
      LEFT JOIN service_points sp ON sp.id = s.service_point_id
      LEFT JOIN entry_points ep ON ep.id = s.entry_point_id
     WHERE s.store_id = ${id} AND s.status IN ('waiting', 'called')
     ORDER BY s.created_at ASC
  `) as Array<Record<string, unknown>>;

  return ok(c, { queue });
});

// POST /api/v1/admin/queue/call-next -- FIFO, safe with several tills calling at once
admin.post('/queue/call-next', async (c) => {
  // The frontend still posts {store_id}. It is read from the token instead, so a till
  // cannot call the next customer of a store it is not logged into.
  const id = requireStore(c);
  const sql = db();

  // FOR UPDATE SKIP LOCKED is what stops two tills calling the same customer: the second
  // one skips the row the first has locked and takes the next in line. It is a single
  // statement, so its implicit transaction covers the lock -- no explicit BEGIN needed,
  // which is what makes it work unchanged over the HTTP driver.
  const rows = (await sql`
    WITH next_session AS (
      UPDATE sessions SET
        status = 'called',
        called_at = NOW(),
        service_point_id = (SELECT id FROM service_points
                             WHERE store_id = ${id} AND is_active = true LIMIT 1)
      WHERE id = (
        SELECT id FROM sessions
         WHERE store_id = ${id} AND status = 'waiting'
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id, ticket_code, store_id, entry_point_id, service_point_id, called_at,
                ai_conversation_id
    )
    SELECT ns.*, sp.name AS service_point_name
      FROM next_session ns
      LEFT JOIN service_points sp ON sp.id = ns.service_point_id
  `) as Array<Record<string, unknown>>;

  const called = rows[0];
  if (!called) {
    return fail(c, ErrorCode.QUEUE_EMPTY, 'No customers waiting in queue', 404);
  }

  // Summarise the concierge chat in the background so the operator sees context by the time
  // the customer reaches the desk. Under n8n this was an HTTP call to a PUBLIC unauthenticated
  // webhook (internal/ai/summarize) that anyone could hammer to burn the AI budget. Now it
  // is a function call that runs after the response and is unreachable from outside.
  if (called.ai_conversation_id) {
    waitUntil(
      summarizeInBackground(called.ai_conversation_id as string).catch((err) =>
        console.error('[kyros] background summary failed', err)
      )
    );
  }

  return ok(c, {
    session_id: called.id,
    ticket_code: called.ticket_code,
    service_point_id: called.service_point_id,
    service_point_name: called.service_point_name ?? 'Cassa A',
    called_at: called.called_at,
  });
});

async function summarizeInBackground(conversationId: string): Promise<void> {
  const sql = db();

  // Claim the work first. DO NOTHING on conflict means a second call-next on the same
  // conversation finds the placeholder already there and does not pay for a second summary.
  const claimed = (await sql`
    INSERT INTO ai_summaries (conversation_id, summary, sentiment, flags, status)
    VALUES (${conversationId}, '', 0, '[]'::jsonb, 'generating')
    ON CONFLICT (conversation_id) DO NOTHING
    RETURNING conversation_id
  `) as Array<{ conversation_id: string }>;
  if (claimed.length === 0) return;

  const messages = (await sql`
    SELECT role, content
      FROM ai_messages
     WHERE conversation_id = ${conversationId}
     ORDER BY created_at ASC
     LIMIT 30
  `) as Array<{ role: string; content: string }>;

  if (messages.length === 0) {
    await sql`
      UPDATE ai_summaries
         SET summary = 'No conversation', sentiment = 0, flags = '[]'::jsonb,
             status = 'ready', generated_at = NOW()
       WHERE conversation_id = ${conversationId}
    `;
    return;
  }

  const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const result = await summarizeConversation(transcript);

  await sql.transaction((tx) => [
    tx`UPDATE ai_summaries
          SET summary = ${result.summary}, sentiment = ${result.sentiment},
              flags = ${JSON.stringify(result.flags)}::jsonb, model = ${result.model},
              status = ${result.status}, generated_at = NOW()
        WHERE conversation_id = ${conversationId}`,
    tx`INSERT INTO ai_usage_monthly (year_month, total_input_tokens, total_output_tokens, total_cost_eur, last_updated)
       VALUES (TO_CHAR(NOW(), 'YYYY-MM'), ${result.inputTokens}, ${result.outputTokens},
               ${result.costEur}, NOW())
       ON CONFLICT (year_month) DO UPDATE
          SET total_input_tokens  = ai_usage_monthly.total_input_tokens  + EXCLUDED.total_input_tokens,
              total_output_tokens = ai_usage_monthly.total_output_tokens + EXCLUDED.total_output_tokens,
              total_cost_eur      = ai_usage_monthly.total_cost_eur      + EXCLUDED.total_cost_eur,
              last_updated        = NOW()`,
  ]);
}

// PATCH /api/v1/admin/sessions/status -- Mark Served / Mark Missed from the board
admin.patch('/sessions/status', async (c) => {
  const parsed = z
    .object({
      session_id: uuid,
      status: z.enum(['called', 'serving', 'finished', 'missed', 'abandoned', 'cancelled']),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'Invalid session_id or status', 400);
  }
  const { session_id, status } = parsed.data;
  const sid = requireStore(c);
  const sql = db();

  // store_id in the WHERE is the access check: without it, a session id was enough to mark
  // another store's customer as served or missed.
  const rows = (await sql`
    UPDATE sessions SET
      status = ${status},
      served_at   = CASE WHEN ${status} IN ('serving', 'finished') AND served_at IS NULL
                         THEN NOW() ELSE served_at END,
      finished_at = CASE WHEN ${status} IN ('finished', 'missed', 'abandoned', 'cancelled')
                         THEN NOW() ELSE finished_at END,
      missed_at   = CASE WHEN ${status} = 'missed' THEN NOW() ELSE missed_at END
    WHERE id = ${session_id} AND store_id = ${sid}
    RETURNING id, ticket_code, status, finished_at
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) return fail(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);

  return ok(c, {
    session_id: row.id,
    ticket_code: row.ticket_code,
    status: row.status,
    finished_at: row.finished_at,
  });
});

// ---------------------------------------------------------------- settings

// GET /api/v1/admin/stores/settings
admin.get('/stores/settings', async (c) => {
  const id = requireStore(c);
  const sql = db();

  const rows = (await sql`
    SELECT id, name, settings FROM stores WHERE id = ${id}
  `) as Array<{ id: string; name: string; settings: unknown }>;

  const store = rows[0];
  if (!store) return fail(c, ErrorCode.STORE_NOT_FOUND, 'Store not found', 404);

  return ok(c, {
    store_id: store.id,
    store_name: store.name,
    settings: withDefaults(store.settings),
  });
});

// PATCH /api/v1/admin/stores/settings
admin.patch('/stores/settings', async (c) => {
  const id = requireStore(c);
  const patch = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'Body must be a settings object', 400);
  }
  const sql = db();

  const rows = (await sql`SELECT settings FROM stores WHERE id = ${id}`) as Array<{
    settings: unknown;
  }>;
  if (!rows[0]) return fail(c, ErrorCode.STORE_NOT_FOUND, 'Store not found', 404);

  // Read, deep merge in JS, write the whole object back. The `settings || $2::jsonb` the
  // n8n workflow used is a shallow merge: saving just queue.accepting_tickets replaced the
  // entire queue object and silently dropped closed_message and the timeouts.
  const current = (rows[0].settings ?? {}) as Record<string, unknown>;
  const merged = deepMerge(current, patch);

  const updated = (await sql`
    UPDATE stores SET settings = ${JSON.stringify(merged)}::jsonb
     WHERE id = ${id}
    RETURNING id, name, settings
  `) as Array<{ id: string; name: string; settings: unknown }>;

  const store = updated[0];
  return ok(c, {
    store_id: store?.id,
    store_name: store?.name,
    settings: withDefaults(store?.settings),
  });
});

// ---------------------------------------------------------------- entry points

function entryPointUrl(slug: string): string {
  return `${config.publicUrl}/q/${slug}`;
}

// GET /api/v1/admin/entry-points
admin.get('/entry-points', async (c) => {
  const id = requireStore(c);
  const sql = db();

  const rows = (await sql`
    SELECT ep.id, ep.name, ep.slug, ep.store_id, ep.created_at
      FROM entry_points ep
     WHERE ep.store_id = ${id}
     ORDER BY ep.created_at DESC
  `) as Array<Record<string, unknown>>;

  // The URL is built here from KYROS_PUBLIC_URL. The n8n version concatenated the domain
  // inside the SQL, so moving host meant editing two workflows.
  return ok(c, {
    entry_points: rows.map((row) => ({ ...row, url: entryPointUrl(row.slug as string) })),
  });
});

// POST /api/v1/admin/entry-points
admin.post('/entry-points', async (c) => {
  // store_id deliberately absent from the schema: it comes from the token, so an entry
  // point can only ever be created inside the caller's own store.
  const parsed = z
    .object({
      name: z.string().min(1).max(100),
      // Slugs end up in a URL and are globally unique, so constrain the shape here rather
      // than discovering the problem when a QR code will not resolve.
      slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase, digits and dashes only'),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'Invalid entry point', 400, parsed.error.issues);
  }
  const { name, slug } = parsed.data;
  const store_id = requireStore(c);
  const sql = db();

  const rows = (await sql`
    INSERT INTO entry_points (store_id, name, slug)
    VALUES (${store_id}, ${name}, ${slug})
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, name, slug, store_id, created_at
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) {
    return fail(c, ErrorCode.VALIDATION_FAILED, `Slug "${slug}" is already taken`, 409);
  }
  return ok(c, { ...row, url: entryPointUrl(row.slug as string) }, 201);
});

// DELETE /api/v1/admin/entry-points/delete?id=
admin.delete('/entry-points/delete', async (c) => {
  const epId = c.req.query('id');
  if (!epId || !uuid.safeParse(epId).success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'id must be a uuid', 400);
  }
  const sid = requireStore(c);
  const sql = db();

  // Confirm the entry point belongs to the caller's store before anything else. Without
  // this, an id was enough to delete another store's QR entry point and its history.
  const owned = (await sql`
    SELECT id FROM entry_points WHERE id = ${epId} AND store_id = ${sid}
  `) as Array<{ id: string }>;
  if (!owned[0]) return fail(c, ErrorCode.NOT_FOUND, 'Entry point not found', 404);

  const active = (await sql`
    SELECT COUNT(*)::int AS active_count
      FROM sessions
     WHERE entry_point_id = ${epId} AND status IN ('waiting', 'called')
  `) as Array<{ active_count: number }>;

  // Deleting an entry point with live customers behind it would strand them, so refuse
  // rather than cascade.
  if ((active[0]?.active_count ?? 0) > 0) {
    return fail(
      c,
      ErrorCode.VALIDATION_FAILED,
      `${active[0]?.active_count} customer(s) are still in the queue from this entry point`,
      409
    );
  }

  // Historical sessions reference the entry point, so they go first.
  const [, deleted] = await sql.transaction((tx) => [
    tx`DELETE FROM sessions WHERE entry_point_id = ${epId}`,
    tx`DELETE FROM entry_points WHERE id = ${epId} RETURNING id`,
  ]);

  const gone = (deleted as Array<{ id: string }>)[0];
  if (!gone) return fail(c, ErrorCode.NOT_FOUND, 'Entry point not found', 404);
  return ok(c, { deleted: true });
});

// ---------------------------------------------------------------- marketing cards

const cardFields = {
  type: z.string().min(1).max(20),
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  icon: z.string().max(50).optional(),
  theme: z.string().max(20).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
};

// GET /api/v1/admin/marketing-cards
admin.get('/marketing-cards', async (c) => {
  const id = requireStore(c);
  const sql = db();

  const cards = (await sql`
    SELECT id, type, title, content,
           icon_name  AS icon,
           theme_color AS theme,
           priority,
           is_active  AS "isActive"
      FROM marketing_cards
     WHERE store_id = ${id}
        OR (store_id IS NULL
            AND tenant_id = (SELECT tenant_id FROM stores WHERE id = ${id}))
     ORDER BY priority DESC, created_at DESC
  `) as Array<Record<string, unknown>>;

  return ok(c, { cards });
});

// POST /api/v1/admin/marketing-cards
admin.post('/marketing-cards', async (c) => {
  // store_id comes from the token, not the body, so a card cannot be planted in another
  // store's waiting room.
  const parsed = z.object(cardFields).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'Invalid card', 400, parsed.error.issues);
  }
  const d = parsed.data;
  const storeIdFromToken = requireStore(c);
  const sql = db();

  // tenant_id is taken from the store rather than trusted from the body, so a card can
  // never be filed under someone else's brand.
  const rows = (await sql`
    INSERT INTO marketing_cards
      (store_id, tenant_id, type, title, content, icon_name, theme_color, priority, scope, is_active)
    SELECT ${storeIdFromToken}, s.tenant_id, ${d.type}, ${d.title}, ${d.content},
           ${d.icon ?? 'Star'}, ${d.theme ?? 'blue'}, ${d.priority ?? 0}, 'LOCAL', true
      FROM stores s WHERE s.id = ${storeIdFromToken}
    RETURNING id, type, title, content, icon_name AS icon, theme_color AS theme,
              priority, is_active AS "isActive"
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) return fail(c, ErrorCode.STORE_NOT_FOUND, 'Store not found', 404);
  return ok(c, row, 201);
});

// PATCH /api/v1/admin/marketing-cards?id=
admin.patch('/marketing-cards', async (c) => {
  const cardId = c.req.query('id');
  if (!cardId || !uuid.safeParse(cardId).success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'id must be a uuid', 400);
  }
  const parsed = z
    .object({
      type: cardFields.type.optional(),
      title: cardFields.title.optional(),
      content: cardFields.content.optional(),
      icon: cardFields.icon,
      theme: cardFields.theme,
      priority: cardFields.priority,
      isActive: cardFields.isActive,
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'Invalid card', 400, parsed.error.issues);
  }
  const d = parsed.data;
  const sid = requireStore(c);
  const tid = sessionTenantId(c);
  const sql = db();

  // COALESCE on every column makes this a real partial update: the frontend sends only what
  // changed, and omitted fields keep their stored value instead of being nulled.
  //
  // The store/tenant clause is the access check. Without it, knowing a card's uuid was
  // enough to edit another store's waiting room, since the id alone identifies the row.
  const rows = (await sql`
    UPDATE marketing_cards SET
      type        = COALESCE(${d.type ?? null}, type),
      title       = COALESCE(${d.title ?? null}, title),
      content     = COALESCE(${d.content ?? null}, content),
      icon_name   = COALESCE(${d.icon ?? null}, icon_name),
      theme_color = COALESCE(${d.theme ?? null}, theme_color),
      priority    = COALESCE(${d.priority ?? null}, priority),
      is_active   = COALESCE(${d.isActive ?? null}, is_active),
      updated_at  = NOW()
    WHERE id = ${cardId}
      AND (store_id = ${sid} OR (store_id IS NULL AND tenant_id = ${tid}))
    RETURNING id, type, title, content, icon_name AS icon, theme_color AS theme,
              priority, is_active AS "isActive"
  `) as Array<Record<string, unknown>>;

  const row = rows[0];
  if (!row) return fail(c, ErrorCode.NOT_FOUND, 'Card not found', 404);
  return ok(c, row);
});

// DELETE /api/v1/admin/marketing-cards?id=
admin.delete('/marketing-cards', async (c) => {
  const cardId = c.req.query('id');
  if (!cardId || !uuid.safeParse(cardId).success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'id must be a uuid', 400);
  }
  const sid = requireStore(c);
  const tid = sessionTenantId(c);
  const sql = db();

  // Same scoping as the PATCH: a card belonging to another store is simply not found,
  // rather than deleted.
  const rows = (await sql`
    DELETE FROM marketing_cards
     WHERE id = ${cardId}
       AND (store_id = ${sid} OR (store_id IS NULL AND tenant_id = ${tid}))
    RETURNING id
  `) as Array<{ id: string }>;

  if (!rows[0]) return fail(c, ErrorCode.NOT_FOUND, 'Card not found', 404);
  return ok(c, { deleted: true });
});

// ---------------------------------------------------------------- AI

// POST /api/v1/admin/wiki/reload
//
// Semantics changed with the move to serverless. The wiki is baked into the bundle at build
// time, so there is nothing to reload at runtime: editing a page means a commit, which
// triggers a redeploy. This now reports which version is live.
admin.post('/wiki/reload', async (c) => {
  const wiki = await loadWiki();
  if (!wiki) {
    return fail(c, ErrorCode.WIKI_NOT_LOADED, 'Knowledge base is not bundled in this build.', 503);
  }
  return ok(c, {
    status: 'loaded',
    wiki_version: wiki.version,
    file_count: wiki.fileCount,
    files: wiki.files,
    built_at: wiki.builtAt,
  });
});

// GET /api/v1/admin/usage
//
// store_id is accepted and ignored: ai_usage_monthly has no store column, so the figure is
// tenant-wide. That was true under n8n too. Making it per-store is a schema change, not a
// query change, and is out of scope for the migration.
admin.get('/usage', async (c) => {
  const sql = db();
  const rows = (await sql`
    SELECT year_month, total_input_tokens, total_output_tokens, total_cost_eur, last_updated
      FROM ai_usage_monthly
     WHERE year_month = TO_CHAR(NOW(), 'YYYY-MM')
     LIMIT 1
  `) as Array<Record<string, unknown>>;

  const row = rows[0] ?? {};
  const cost = Number(row.total_cost_eur ?? 0);
  const cap = config.aiBudgetEur;

  return ok(c, {
    year_month: row.year_month ?? new Date().toISOString().slice(0, 7),
    total_input_tokens: Number(row.total_input_tokens ?? 0),
    total_output_tokens: Number(row.total_output_tokens ?? 0),
    total_cost_eur: cost,
    // Returned so AIUsageCard.tsx can stop hardcoding 3.0 and read the real cap.
    cap_eur: cap,
    percent_used: cap > 0 ? Math.round((cost / cap) * 100) : 0,
    last_updated: row.last_updated ?? null,
  });
});

export default admin;
