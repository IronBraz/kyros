/**
 * Seeds a fresh Kyros database: one tenant, one store, one admin PIN, one entry point,
 * two service points, a few marketing cards.
 *
 * Fresh start by design -- nothing is migrated from the n8n Postgres, that was demo data.
 *
 * The admin PIN is NEVER hardcoded here. It comes from KYROS_SEED_ADMIN_PIN and only its
 * scrypt hash reaches the database. The old demo PIN `1234` is published on GitHub in the
 * repo history; do not reuse it.
 *
 * Usage:
 *   $env:KYROS_SEED_ADMIN_PIN = "<pin>"
 *   npm run db:seed
 *
 * Idempotent: re-running updates the same rows instead of creating duplicates.
 */
import './load-env.js'; // side effect: reads .env.local. Must stay first.
import { Client } from '@neondatabase/serverless';
import { hashPin } from '../server/lib/pin.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'DATABASE_URL is not set, and .env.local does not provide it.\n' +
      '  Fix:  npx vercel env pull .env.local'
  );
  process.exit(1);
}

const pin = process.env.KYROS_SEED_ADMIN_PIN;
if (!pin || !/^\d{4,6}$/.test(pin)) {
  console.error(
    'KYROS_SEED_ADMIN_PIN must be set to a 4-6 digit PIN.\n' +
      '  PowerShell:  $env:KYROS_SEED_ADMIN_PIN = "<pin>"\n' +
      'Do not reuse 1234: it is published in this repo\'s history.'
  );
  process.exit(1);
}
if (pin === '1234') {
  console.error('Refusing to seed with 1234: that PIN is published on GitHub. Pick another.');
  process.exit(1);
}

const TENANT_NAME = process.env.KYROS_SEED_TENANT ?? 'Kyros Demo';
const STORE_NAME = process.env.KYROS_SEED_STORE ?? 'Milano Centro';
// Same domain the n8n backend hardcoded into the QR URLs, now pointed at Vercel instead of
// the Cloudflare Tunnel. Keeping it means already-printed QR codes stay valid.
const PUBLIC_URL = process.env.KYROS_PUBLIC_URL ?? 'https://kyros.neuroforge.club';

// Mirrors exactly what the Control Room settings panel reads back
// (pwa/src/routes/admin/ControlRoom.tsx:141-150) plus qr_base_url, which only the backend
// uses. Thresholds follow the plan: ghost 30 min, called 5 min.
const STORE_SETTINGS = {
  queue: {
    accepting_tickets: true,
    closed_message: 'We are currently closed. Please come back later.',
    avg_service_time_minutes: 5,
    ghost_timeout_minutes: 30,
    called_timeout_minutes: 5,
  },
  display: {
    welcome_message: 'Welcome! You are in the queue.',
    language: 'it',
  },
  notifications: {
    call_sound: 'ding-dong',
  },
  qr_base_url: PUBLIC_URL,
};

const MARKETING_CARDS = [
  {
    type: 'INFO',
    title: 'Benvenuto da Kyros',
    content: 'Sei in coda. Ti avvisiamo noi quando tocca a te: puoi guardarti intorno.',
    icon_name: 'Info',
    theme_color: 'teal',
    priority: 30,
  },
  {
    type: 'PROMO',
    title: 'Novita in negozio',
    content: 'Chiedi al concierge cosa e appena arrivato: risponde qui in chat.',
    icon_name: 'Sparkles',
    theme_color: 'blue',
    priority: 20,
  },
  {
    type: 'TRIVIA',
    title: 'Lo sapevi?',
    content: "L'attesa percepita si accorcia di circa un terzo quando sai quanto manca.",
    icon_name: 'Lightbulb',
    theme_color: 'purple',
    priority: 10,
  },
];

const client = new Client(url);
await client.connect();

try {
  const pinHash = await hashPin(pin);

  // Look up FIRST, insert only when genuinely absent.
  //
  // This used to INSERT ... ON CONFLICT DO NOTHING RETURNING id and fall back to a SELECT
  // when the insert returned nothing. tenants has no unique constraint on name, so the
  // insert always succeeded, always returned an id, and the fallback never ran: every run
  // made a new tenant, a new store under it (the store lookup below is scoped by tenant_id),
  // and a second copy of everything. It bit for real on 2026-08-17, when re-seeding to change
  // the admin PIN put the new PIN on a duplicate store and left the old one live.
  const { rows: found } = await client.query<{ id: string }>(
    `SELECT id FROM tenants WHERE name = $1 ORDER BY created_at LIMIT 1`,
    [TENANT_NAME]
  );
  let tenantId = found[0]?.id;
  if (!tenantId) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO tenants (name) VALUES ($1) RETURNING id`,
      [TENANT_NAME]
    );
    tenantId = rows[0]?.id;
  }
  if (!tenantId) throw new Error('failed to create or find tenant');
  console.log(`[db-seed] tenant  ${tenantId}  "${TENANT_NAME}"`);

  const { rows: existingStore } = await client.query<{ id: string }>(
    `SELECT id FROM stores WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
    [tenantId, STORE_NAME]
  );
  let storeId = existingStore[0]?.id;
  if (storeId) {
    await client.query(`UPDATE stores SET settings = $2::jsonb WHERE id = $1`, [
      storeId,
      JSON.stringify(STORE_SETTINGS),
    ]);
  } else {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO stores (tenant_id, name, address, timezone, settings)
       VALUES ($1, $2, $3, 'Europe/Rome', $4::jsonb)
       RETURNING id`,
      [tenantId, STORE_NAME, 'Via Demo 1, Milano', JSON.stringify(STORE_SETTINGS)]
    );
    storeId = rows[0]?.id;
  }
  if (!storeId) throw new Error('failed to create or find store');
  console.log(`[db-seed] store   ${storeId}  "${STORE_NAME}"  tz Europe/Rome`);

  // UNIQUE(store_id, label) makes this a real upsert.
  await client.query(
    `INSERT INTO admin_access (store_id, access_code_hash, label, is_active)
     VALUES ($1, $2, 'Manager', true)
     ON CONFLICT (store_id, label) DO UPDATE SET access_code_hash = EXCLUDED.access_code_hash,
                                                is_active = true`,
    [storeId, pinHash]
  );
  console.log(`[db-seed] admin   PIN hashed (scrypt), label "Manager"`);

  // slug is globally UNIQUE, so this upsert also re-points an existing slug at this store.
  const { rows: epRows } = await client.query<{ id: string; slug: string }>(
    `INSERT INTO entry_points (store_id, name, slug)
     VALUES ($1, 'Ingresso Principale', 'main-entrance')
     ON CONFLICT (slug) DO UPDATE SET store_id = EXCLUDED.store_id, name = EXCLUDED.name
     RETURNING id, slug`,
    [storeId]
  );
  const entryPoint = epRows[0];
  console.log(`[db-seed] entry   ${entryPoint?.id}  ${PUBLIC_URL}/q/${entryPoint?.slug}`);

  for (const name of ['Cassa 1', 'Cassa 2']) {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM service_points WHERE store_id = $1 AND name = $2 LIMIT 1`,
      [storeId, name]
    );
    if (!rows[0]) {
      await client.query(
        `INSERT INTO service_points (store_id, name, is_active) VALUES ($1, $2, true)`,
        [storeId, name]
      );
    }
  }
  console.log(`[db-seed] service Cassa 1, Cassa 2`);

  for (const card of MARKETING_CARDS) {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM marketing_cards WHERE store_id = $1 AND title = $2 LIMIT 1`,
      [storeId, card.title]
    );
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
          tenantId, storeId, card.type, card.title, card.content,
          card.icon_name, card.theme_color, card.priority,
        ]
      );
    }
  }
  console.log(`[db-seed] cards   ${MARKETING_CARDS.length}`);

  console.log('\n[db-seed] done. Values you need:');
  console.log(`  store_id        ${storeId}`);
  console.log(`  entry point URL ${PUBLIC_URL}/q/${entryPoint?.slug}`);
} finally {
  await client.end();
}
