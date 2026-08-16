// Endpoints Vercel calls on a schedule. Never reachable from a browser.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` on cron invocations, and CRON_SECRET is
// injected into the project automatically. Anything without it gets a 401 -- which is the
// whole difference from the n8n era, where internal/ai/summarize was a public webhook that
// anyone could call to burn the AI budget.
import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { db } from '../lib/db.js';
import { sweep } from '../lib/janitor.js';
import { ErrorCode, fail, ok } from '../lib/respond.js';

const internal = new Hono();

function authorized(header: string | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means the endpoint stays shut, rather than open to everyone.
  if (!secret) {
    console.error('[kyros] CRON_SECRET is not set: refusing all /api/internal requests');
    return false;
  }
  const provided = header?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // Compare in constant time, but only after a length check: timingSafeEqual throws on a
  // length mismatch, and the throw itself would leak the secret's length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

internal.use('*', async (c, next) => {
  if (!authorized(c.req.header('authorization'))) {
    return fail(c, ErrorCode.UNAUTHORIZED, 'Missing or invalid cron secret', 401);
  }
  await next();
});

/**
 * Nightly maintenance, 02:00 UTC.
 *
 * Covers the case the lazy janitor cannot: nobody polling the Control Room, so sessions
 * hang all night. Runs the full sweep with no throttle, then resets the ticket sequences
 * for any store whose local date has moved on.
 */
internal.get('/cron/daily', async (c) => {
  const sql = db();

  const swept = await sweep();

  // store_today() computes the date in each store's own timezone, so a chain spanning
  // several zones resets each store at its own midnight rather than all at 02:00 UTC.
  const reset = (await sql`
    UPDATE ticket_sequences ts
       SET current_number = 0, prefix = 'A', last_reset_date = store_today(ts.store_id)
     WHERE ts.last_reset_date < store_today(ts.store_id)
    RETURNING ts.store_id, ts.last_reset_date
  `) as Array<Record<string, unknown>>;

  // Expired buckets are treated as full by the limiter, so they are dead weight. Cleared
  // here rather than on every request.
  const limits = (await sql`
    DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day' RETURNING bucket
  `) as Array<{ bucket: string }>;

  const result = {
    sessions_abandoned: swept.abandoned,
    sessions_missed: swept.missed,
    ticket_sequences_reset: reset.length,
    rate_limit_buckets_cleared: limits.length,
    ran_at: new Date().toISOString(),
  };
  console.log('[kyros] daily cron', result);
  return ok(c, result);
});

/**
 * Same sweep, no throttle, on demand. Exists so the janitor can be driven from outside if
 * the lazy path is ever not enough -- for example a scheduled GitHub Action every 15
 * minutes, which is free and does not need a Vercel Pro plan.
 */
internal.post('/janitor/sweep', async (c) => {
  const swept = await sweep();
  return ok(c, { ...swept, ran_at: new Date().toISOString() });
});

export default internal;
