// Neon HTTP driver. One fetch per query, no TCP handshake, no connection pool to exhaust.
//
// Why not `pg`: every serverless invocation is a fresh process, so a pool never gets reused
// and the database runs out of connections under any real load.
//
// Use the tagged template form everywhere -- it parameterises automatically:
//     const rows = await sql`SELECT * FROM stores WHERE id = ${storeId}`;
// Never build SQL by string concatenation.
//
// For writes that must be atomic together, use `sql.transaction([...])`, which sends the
// batch inside a real transaction. A single statement (like the call-next UPDATE with its
// FOR UPDATE SKIP LOCKED subquery) is already covered by its implicit transaction.
import { neon } from '@neondatabase/serverless';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. On Vercel it is injected by the Neon marketplace integration; ' +
        'locally put it in .env.local and run through `vercel dev`.'
    );
  }
  return url;
}

let cached: ReturnType<typeof neon> | undefined;

/**
 * Lazily built so that importing this module never throws at cold start -- only the first
 * actual query does, which keeps the error inside a request and visible in the response.
 */
export function db(): ReturnType<typeof neon> {
  cached ??= neon(connectionString());
  return cached;
}

/** First row or undefined. The common "look it up, might not exist" shape. */
export function one<T>(rows: T[]): T | undefined {
  return rows[0];
}
