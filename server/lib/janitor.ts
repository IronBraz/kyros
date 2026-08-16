// Queue housekeeping: ghost sessions and no-shows.
//
// Under n8n this was a cron every 5 minutes. Vercel Hobby allows at most 2 crons and only
// daily, so "*/5 * * * *" is not available. Instead the sweep runs lazily inside
// GET /admin/queue/status -- the endpoint the Control Room polls every 2-5 seconds -- and
// job_runs throttles it to once a minute.
//
// The result is better than what it replaces: during a demo the janitor runs every 60
// seconds instead of every 5 minutes, so a no-show leaves the board within a minute.
//
// The gap it does not cover is "nobody is looking": store closed, Control Room closed,
// sessions hanging overnight. That is what the daily Vercel cron is for, which calls
// sweep() directly with no throttle.
import { db } from './db.js';
import { config } from './config.js';

export interface SweepResult {
  abandoned: number;
  missed: number;
}

/**
 * Marks stale sessions. Thresholds come from each store's own settings
 * (`queue.ghost_timeout_minutes`, `queue.called_timeout_minutes`), which the Settings panel
 * has always exposed but the n8n janitor only half honoured: it read the ghost timeout and
 * hardcoded the called timeout at 5 minutes.
 *
 * Runs across all stores in two statements. No transaction needed: each UPDATE is atomic on
 * its own and they touch disjoint sets of rows (status = 'waiting' vs status = 'called').
 */
export async function sweep(): Promise<SweepResult> {
  const sql = db();

  const abandoned = (await sql`
    UPDATE sessions s
       SET status = 'abandoned', finished_at = NOW()
      FROM stores st
     WHERE s.store_id = st.id
       AND s.status = 'waiting'
       AND s.last_seen_at < NOW() - (
             COALESCE((st.settings->'queue'->>'ghost_timeout_minutes')::int, 30) || ' minutes'
           )::interval
    RETURNING s.id
  `) as Array<{ id: string }>;

  const missed = (await sql`
    UPDATE sessions s
       SET status = 'missed', missed_at = NOW()
      FROM stores st
     WHERE s.store_id = st.id
       AND s.status = 'called'
       AND s.called_at < NOW() - (
             COALESCE((st.settings->'queue'->>'called_timeout_minutes')::int, 5) || ' minutes'
           )::interval
    RETURNING s.id
  `) as Array<{ id: string }>;

  return { abandoned: abandoned.length, missed: missed.length };
}

/**
 * Runs sweep() only if no one else has run it in the last janitorMinIntervalSeconds.
 *
 * The lock is the UPDATE itself. Either it touches the row -- and this caller owns the slot
 * -- or it touches nothing, because a concurrent request got there first. Atomic in a single
 * statement, so it works over the HTTP driver with no explicit transaction, and two Control
 * Room tabs polling in parallel cannot both trigger a sweep.
 *
 * Returns null when the sweep was skipped.
 */
export async function sweepIfDue(): Promise<SweepResult | null> {
  const sql = db();
  const seconds = config.janitorMinIntervalSeconds;

  const claimed = (await sql`
    INSERT INTO job_runs (job, last_run_at)
    VALUES ('janitor', NOW())
    ON CONFLICT (job) DO UPDATE
       SET last_run_at = NOW()
     WHERE job_runs.last_run_at < NOW() - (${seconds} || ' seconds')::interval
    RETURNING job
  `) as Array<{ job: string }>;

  if (claimed.length === 0) return null;
  return sweep();
}
