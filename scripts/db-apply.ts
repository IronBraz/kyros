/**
 * Applies database/kyros_schema.sql to whatever DATABASE_URL points at.
 *
 * Uses the WebSocket Client, not the HTTP `neon()` helper: the HTTP driver sends one
 * statement per request, and the schema is a single script with function bodies that
 * contain semicolons inside `$$ ... $$`. Splitting it by hand would break those.
 * The Client speaks the simple query protocol, which takes the whole file in one go.
 *
 * The schema is idempotent (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION), so
 * re-running it is safe -- but note it does NOT drop columns that were removed. Coming from
 * the n8n database, `admin_access.access_code` would survive; on a fresh Neon database, as
 * planned, there is nothing to survive.
 *
 * Usage:  npm run db:apply
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@neondatabase/serverless';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(resolve(here, '..'), 'database', 'kyros_schema.sql');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Put it in .env.local or export it before running.');
  process.exit(1);
}

const schema = readFileSync(schemaPath, 'utf8');
console.log(`[db-apply] applying ${schemaPath} (${schema.length} chars)`);

const client = new Client(url);
await client.connect();

try {
  await client.query(schema);
  console.log('[db-apply] schema applied');

  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log(`[db-apply] ${rows.length} tables: ${rows.map((r) => r.table_name).join(', ')}`);

  const { rows: fns } = await client.query<{ proname: string }>(
    `SELECT proname FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' ORDER BY proname`
  );
  console.log(`[db-apply] functions: ${fns.map((f) => f.proname).join(', ')}`);
} finally {
  await client.end();
}
