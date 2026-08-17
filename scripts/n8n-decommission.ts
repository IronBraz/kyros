/**
 * Switches off the old n8n backend, one time, at the end of the Vercel migration.
 *
 * Deactivates every workflow whose name starts with "Kyros - " and then archives it.
 * Archive, not delete: n8n can unarchive, and every one of these is also exported verbatim
 * in n8n/live_export_2026-08-16/ plus frozen at the tag v1.5.0-n8n-final and the branch
 * legacy/n8n. Deleting would buy nothing and close the rollback door.
 *
 * Why this exists at all, given the n8n MCP tools: those only reach workflows with "available
 * in MCP" ticked, which on 2026-08-17 was 10 of the 30. The public REST API has no such gate.
 *
 * Get a key from the n8n UI: Settings -> n8n API -> Create an API key.
 *
 *   $env:N8N_API_KEY = "<key>"
 *   npx tsx scripts/n8n-decommission.ts            # list what it would touch
 *   npx tsx scripts/n8n-decommission.ts --apply    # do it
 *
 * N8N_BASE_URL defaults to the local instance.
 */
export {}; // makes this a module, so the top-level awaits below are legal

const base = (process.env.N8N_BASE_URL ?? 'http://localhost:5678').replace(/\/$/, '');
const key = process.env.N8N_API_KEY;
const apply = process.argv.includes('--apply');
const PREFIX = process.env.N8N_WORKFLOW_PREFIX ?? 'Kyros - ';

if (!key) {
  console.error(
    'N8N_API_KEY is not set.\n' +
      '  n8n UI -> Settings -> n8n API -> Create an API key, then:\n' +
      '  $env:N8N_API_KEY = "<key>"'
  );
  process.exit(1);
}

type Workflow = { id: string; name: string; active: boolean };

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: { 'X-N8N-API-KEY': key!, 'Content-Type': 'application/json', ...init.headers },
  });
}

// The list endpoint pages at 250 by default; cursor through it so nothing is missed.
const all: Workflow[] = [];
let cursor: string | undefined;
do {
  const res = await api(`/workflows?limit=250${cursor ? `&cursor=${cursor}` : ''}`);
  if (!res.ok) {
    console.error(`GET /workflows failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body = (await res.json()) as { data: Workflow[]; nextCursor?: string };
  all.push(...body.data);
  cursor = body.nextCursor;
} while (cursor);

const targets = all.filter((w) => w.name.startsWith(PREFIX));
console.log(
  `[n8n] ${all.length} workflows total, ${targets.length} matching "${PREFIX}"` +
    `${apply ? '' : '   (dry run)'}\n`
);

let deactivated = 0;
let archived = 0;
let failed = 0;

for (const w of targets) {
  const plan = w.active ? 'deactivate + archive' : 'archive';
  console.log(`  ${plan.padEnd(22)} ${w.name}`);
  if (!apply) continue;

  // Order matters: n8n refuses to archive a workflow that is still active.
  if (w.active) {
    const res = await api(`/workflows/${w.id}/deactivate`, { method: 'POST' });
    if (!res.ok) {
      console.log(`    deactivate FAILED ${res.status} ${await res.text()}`);
      failed++;
      continue;
    }
    deactivated++;
  }

  const res = await api(`/workflows/${w.id}/archive`, { method: 'POST' });
  if (res.ok) {
    archived++;
  } else {
    // Older n8n builds have no /archive. Deactivating is already the safe half of the job,
    // so say so plainly rather than pretending the workflow is gone.
    console.log(`    archive FAILED ${res.status} ${await res.text()}`);
    failed++;
  }
}

if (apply) {
  console.log(`\n[n8n] deactivated ${deactivated}, archived ${archived}, failed ${failed}`);
  const check = await api('/workflows?limit=250&active=true');
  if (check.ok) {
    const body = (await check.json()) as { data: Workflow[] };
    const stillOn = body.data.filter((w) => w.name.startsWith(PREFIX));
    console.log(`[n8n] still active with prefix "${PREFIX}": ${stillOn.length}`);
    for (const w of stillOn) console.log(`  ${w.name}`);
  }
} else {
  console.log('\nNothing was changed. Re-run with:  npx tsx scripts/n8n-decommission.ts --apply');
}
