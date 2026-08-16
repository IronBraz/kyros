// Token bucket rate limiting on Postgres.
//
// Postgres rather than Redis because there is no Redis: adding one would mean another
// service, another credential and another thing that can be down. The volumes here are a
// handful of requests per second, which a single indexed upsert handles without noticing.
//
// The one that actually matters is the login. A 4-digit PIN is 10,000 combinations and
// under n8n they were all testable as fast as the network allowed.
import { db } from './db.js';

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens left in the window. Never negative in the response. */
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Consumes one token from `bucket`.
 *
 * A single upsert does everything: create the bucket, refill it if the window has expired,
 * or decrement it. Atomic, so two simultaneous requests cannot both see the last token --
 * which is exactly the case a brute-force script produces.
 *
 * Fails open. If the rate-limit table is unreachable the request proceeds: a database
 * hiccup taking down the login for everyone would be a worse outcome than briefly losing
 * throttling, and the PIN is hashed regardless.
 */
export async function consume(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const sql = db();

  try {
    const rows = (await sql`
      INSERT INTO rate_limits (bucket, tokens, reset_at)
      VALUES (${bucket}, ${limit - 1}, NOW() + (${windowSeconds} || ' seconds')::interval)
      ON CONFLICT (bucket) DO UPDATE SET
        tokens = CASE
                   WHEN rate_limits.reset_at < NOW() THEN ${limit - 1}
                   ELSE rate_limits.tokens - 1
                 END,
        reset_at = CASE
                     WHEN rate_limits.reset_at < NOW()
                       THEN NOW() + (${windowSeconds} || ' seconds')::interval
                     ELSE rate_limits.reset_at
                   END
      RETURNING tokens,
                GREATEST(0, CEIL(EXTRACT(EPOCH FROM (reset_at - NOW()))))::int AS retry_after
    `) as Array<{ tokens: number; retry_after: number }>;

    const row = rows[0];
    if (!row) return { allowed: true, remaining: limit, retryAfterSeconds: 0 };

    return {
      allowed: row.tokens >= 0,
      remaining: Math.max(0, row.tokens),
      retryAfterSeconds: row.retry_after,
    };
  } catch (err) {
    console.error('[kyros] rate limiter unavailable, allowing request', err);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** The limits, in one place so they can be read at a glance. */
export const Limits = {
  /** PIN login. 10 tries per 15 minutes per (store, ip). */
  adminLogin: { limit: 10, windowSeconds: 15 * 60 },
  /** Taking a ticket. Stops one phone flooding the queue. */
  createSession: { limit: 20, windowSeconds: 60 },
  /** Concierge messages. Protects the AI budget from a single chatty client. */
  chatSend: { limit: 20, windowSeconds: 5 * 60 },
} as const;
