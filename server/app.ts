import { Hono } from 'hono';
import { db } from './lib/db.js';
import { ErrorCode, fail, ok } from './lib/respond.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import clientRoutes from './routes/client.js';
import internalRoutes from './routes/internal.js';

const app = new Hono();

// Uncaught errors never leak a stack trace to the client, and always come back in the
// standard envelope so the PWA's `success` check still works on a 500.
app.onError((err, c) => {
  console.error('[kyros] unhandled error', { path: c.req.path, method: c.req.method, err });
  return fail(c, ErrorCode.INTERNAL_ERROR, 'Something went wrong', 500);
});

app.notFound((c) => fail(c, ErrorCode.NOT_FOUND, `No route for ${c.req.method} ${c.req.path}`, 404));

/**
 * Liveness + database reachability. Same query the n8n "System Health" workflow ran, so the
 * two backends can be compared directly during the migration.
 */
app.get('/api/v1/health', async (c) => {
  const sql = db();
  const rows = (await sql`
    SELECT
      'ok'                          AS status,
      version()                     AS db_version,
      current_timestamp             AS server_time,
      (SELECT count(*) FROM stores) AS store_count
  `) as Array<Record<string, unknown>>;

  return ok(c, rows[0] ?? {});
});

// The chat routes live under /client because that is where the PWA calls them
// (/api/v1/client/chat/start), even though they are a separate concern in the code.
app.route('/api/v1/client', clientRoutes);
app.route('/api/v1/client', chatRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/internal', internalRoutes);

export default app;
