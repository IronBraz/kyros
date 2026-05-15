# n8n Workflows

The Kyros backend is implemented as n8n workflows. Each `.json` file in this folder is a self-contained workflow export that can be imported into a self-hosted n8n instance.

## Prerequisites

- A running n8n instance (self-hosted, Docker or npm)
- A PostgreSQL 18.1 database with the schema from [`../database/kyros_schema.sql`](../database/kyros_schema.sql) applied
- An n8n credential of type **Postgres** named `postgres-kyros-cred` pointing to that database

## Import order

n8n does not enforce import order, but to keep referenced sub-workflow IDs valid, import in this sequence:

1. **Sub-workflows first** (other workflows reference them by ID):
   - `005_SUB_Response_Standardizer.json` — standard JSON response wrapper
   - `006_SUB_Auth_Manager.json` — JWT session token handling

2. **Infrastructure** (one-shot setup, run once):
   - `001_health_check.json`
   - `002_init_tenant.json`
   - `003_setup_tenant_v3.json` (the canonical version; `_v2` and the unsuffixed file are kept for history)
   - `004_infrastructure_mgmt_FINAL.json` (other `004_*` files are earlier iterations)

3. **Client API** (`/api/v1/client/*`):
   - `008_API_Client_CreateSession.json`
   - `009_API_Client_GetSession.json`
   - `010_API_Client_Heartbeat.json`
   - `011_API_Client_Abandon.json`
   - `020_API_Client_MarketingCards.json`

4. **Admin API** (`/api/v1/admin/*`):
   - `012_API_Admin_GetStores.json`
   - `013_API_Admin_AuthVerify.json`
   - `014_API_Admin_CallNext.json`
   - `015_API_Admin_GetQueue.json`
   - `016_API_Admin_UpdateSettings.json`
   - `017_API_Admin_GetQueueStatus.json`
   - `021_API_Admin_EntryPoints.json`
   - `022_API_Admin_DeleteEntryPoint.json`
   - `023_API_Admin_MarketingCards.json`
   - `024_API_Admin_SessionCleanup.json`

5. **Background jobs** (cron-triggered):
   - `018_JOB_Janitor.json` — every 5 min, marks ghost sessions
   - `019_JOB_Daily_Reset.json` — midnight (store timezone), resets daily ticket sequences

## After import

- Open each imported workflow and re-bind sub-workflow references if n8n shows them as broken (re-pick from the dropdown).
- Activate the workflows you want live (toggle "Inactive" → "Active").
- Verify the Postgres credential is selected on every Postgres node.

## Per-store configuration

The `021_API_Admin_EntryPoints.json` workflow generates QR-code URLs by reading `stores.settings->>'qr_base_url'` from the database. **You must set this value once per store**, otherwise the URL falls back to `https://your-domain.example.com/q/{slug}`.

```sql
UPDATE stores
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
    'qr_base_url', 'https://kyros.example.com'
)
WHERE id = 'YOUR-STORE-UUID';
```

A template script is in [`../database/setup-store.sql.example`](../database/setup-store.sql.example).

## Standard response format

All API workflows wrap responses through `005_SUB_Response_Standardizer`:

```json
{ "success": true, "data": {...}, "error": null,
  "meta": { "timestamp": "...", "request_id": "..." } }
```

See [`../specs/05_Infra_Architecture.md`](../specs/05_Infra_Architecture.md) for the full API contract.

## Note on file naming

Some workflows have `_v2`, `_v3`, `_FINAL`, `_fix` suffixes — these are historical iterations kept intentionally. The "canonical" version is the one with the highest version number or the `_FINAL` suffix.
