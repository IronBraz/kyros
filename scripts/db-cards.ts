/**
 * Reconciles the content feed of an existing store against scripts/marketing-cards.ts.
 *
 * Split out of db-seed.ts because changing a card should not require the admin PIN:
 * db-seed re-hashes the PIN on every run, so it cannot be used to touch content alone.
 *
 * Reconcile, not insert: cards in the list are upserted by title, and any other LOCAL card
 * on the store is deactivated (is_active = false), never deleted. Deactivating keeps the
 * row addressable from the Content screen if the owner wants it back, and keeps any
 * analytics that reference it intact.
 *
 * Usage:
 *   npm run db:cards            # show what would change
 *   npm run db:cards -- --apply # write it
 */
import './load-env.js'; // side effect: reads .env.local. Must stay first.
import { Client } from '@neondatabase/serverless';
import { MARKETING_CARDS } from './marketing-cards.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'DATABASE_URL is not set, and .env.local does not provide it.\n' +
      '  Fix:  npx vercel env pull .env.local'
  );
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const STORE_NAME = process.env.KYROS_SEED_STORE ?? 'Milano Centro';

const client = new Client(url);
await client.connect();

try {
  const { rows: stores } = await client.query<{ id: string; tenant_id: string; name: string }>(
    `SELECT id, tenant_id, name FROM stores WHERE name = $1 ORDER BY created_at LIMIT 1`,
    [STORE_NAME]
  );
  const store = stores[0];
  if (!store) throw new Error(`no store named "${STORE_NAME}". Run npm run db:seed first.`);
  console.log(`[db-cards] store   ${store.id}  "${store.name}"${apply ? '' : '   (dry run)'}\n`);

  const keep = new Set(MARKETING_CARDS.map((c) => c.title));

  for (const card of MARKETING_CARDS) {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM marketing_cards WHERE store_id = $1 AND title = $2 LIMIT 1`,
      [store.id, card.title]
    );
    const verb = rows[0] ? 'update' : 'insert';
    console.log(`  ${verb.padEnd(10)} ${card.type.padEnd(7)} ${card.title}`);
    if (!apply) continue;

    if (rows[0]) {
      await client.query(
        `UPDATE marketing_cards
            SET type = $2, content = $3, icon_name = $4, theme_color = $5, priority = $6,
                is_active = true, updated_at = NOW()
          WHERE id = $1`,
        [rows[0].id, card.type, card.content, card.icon_name, card.theme_color, card.priority]
      );
    } else {
      await client.query(
        `INSERT INTO marketing_cards
           (tenant_id, store_id, scope, type, title, content, icon_name, theme_color, priority, is_active)
         VALUES ($1, $2, 'LOCAL', $3, $4, $5, $6, $7, $8, true)`,
        [
          store.tenant_id, store.id, card.type, card.title, card.content,
          card.icon_name, card.theme_color, card.priority,
        ]
      );
    }
  }

  const { rows: strays } = await client.query<{ id: string; title: string; type: string }>(
    `SELECT id, title, type FROM marketing_cards
      WHERE store_id = $1 AND is_active = true AND NOT (title = ANY($2::text[]))`,
    [store.id, [...keep]]
  );
  for (const stray of strays) {
    console.log(`  ${'retire'.padEnd(10)} ${stray.type.padEnd(7)} ${stray.title}`);
    if (apply) {
      await client.query(
        `UPDATE marketing_cards SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [stray.id]
      );
    }
  }

  const { rows: final } = await client.query<{ type: string; title: string; icon_name: string; theme_color: string }>(
    `SELECT type, title, icon_name, theme_color FROM marketing_cards
      WHERE store_id = $1 AND is_active = true ORDER BY priority DESC`,
    [store.id]
  );
  console.log(`\n[db-cards] live feed (${final.length} cards):`);
  for (const c of final) {
    console.log(`  ${c.type.padEnd(7)} ${c.icon_name.padEnd(6)} ${c.theme_color.padEnd(7)} ${c.title}`);
  }
  if (!apply) console.log('\nNothing was written. Re-run with:  npm run db:cards -- --apply');
} finally {
  await client.end();
}
