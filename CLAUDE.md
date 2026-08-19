# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kyros** is a queue management and concierge system for retail stores. It transforms passive waiting into interactive engagement by digitizing customer flow through QR/NFC entry points, real-time queue management, and a content feed system.

**Current Phase**: MVP (Fase 1) - "Store Flow Foundation"
- Focus on validating core queue management mechanics
- Single-store FIFO queue logic
- No AI features yet (placeholders only)
- Extreme MVP philosophy: textual branding, no image uploads, CSS-based theming

## Architecture

### Stack
- **Backend**: **one serverless function** (`api/index.ts`) mounting a Hono app (`server/`), on Vercel
- **Database**: **Neon** serverless Postgres (`eu-central-1`), via `@neondatabase/serverless` in HTTP mode
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Zustand
- **Real-time**: **none — HTTP polling.** There is no Socket.io anywhere in this repo and never was; `SUB_Socket_Emitter` existed only as prose in the specs
- **Infrastructure**: Vercel (team `brainforge1`, project `kyros`, Hobby plan)

> **The n8n backend is history, and the `n8n/` folder is gone from git entirely** — not just
> from `main`, but from every commit, branch and tag. It was deleted from the tree on
> 2026-08-18 and then stripped from the whole history on 2026-08-19 with `git filter-repo`,
> before this repository was made public, because those exports embedded the author's personal
> email address. `git show v1.5.0-n8n-final:n8n/...` no longer resolves: do not reach for it.
> The workflows survive in two places outside git — archived (not deleted) inside the n8n
> instance that ran them, and in a local off-repo archive on the owner's machine. Even then
> they are a rollback artefact, not documentation: the numbered `n8n/*.json` files were
> already stale before the migration (only 7 of 32 still matched the running instance), and
> the `live_export_2026-08-16/` set describes a backend that no longer exists. Task files
> under `project-board/4_DONE/` still cite these paths; that is history talking, not a live
> reference.

### Key Architecture Decisions
- **Multi-tenancy**: Shared database, shared schema (tenant_id/store_id columns)
- **Monolith Frontend**: Single React app serves both Client and Admin interfaces (routes differentiate)
- **Service Points (not Staff)**: Queue activity tracked by physical "Cassa" (checkout counter), not individual operators
- **FIFO Global**: All service points pull from a single store-wide queue in chronological order
- **One function, not one file per route**: keeps a single bundle warm, stays inside the
  Hobby function limit, and gives real middleware instead of per-file copy-paste
- **Same origin**: the SPA and the API share a host, so `API_BASE` stays `''` and there is no CORS
- **HTTP driver, not `pg`**: each invocation is a fresh process, so a connection pool is never
  reused and would exhaust the database. Multi-statement atomicity uses `sql.transaction([...])`

### Rules that are easy to get wrong
1. **`store_id` always comes from the admin session token**, never from the query string or
   body, even though the frontend still sends it. That single rule is what closes the IDORs.
2. **Never `CURRENT_DATE`.** Neon runs in UTC and stores have their own timezone. Use
   `store_today(store_id)` for anything meaning "today".
3. **Never build SQL by concatenation.** Use the tagged template form, which parameterises.
4. **The wiki is a build artefact.** `server/lib/wiki.generated.ts` is gitignored and produced
   by `npm run prebuild`; editing `knowledge/public/*.md` requires a redeploy to take effect.

## Database Schema

The source of truth is `database/kyros_schema.sql`. Key tables:

- **tenants**: Top-level brand/company
- **stores**: Physical locations (has JSONB `settings` for queue config, display options)
- **entry_points**: QR/NFC entry locations within a store
- **service_points**: Physical service stations (Cassa 1, Cassa 2, etc.)
- **sessions**: Customer queue sessions (ticket_code, status lifecycle, heartbeat tracking)
- **marketing_cards**: Content feed for client waiting room
- **admin_access**: PIN-based access codes for Control Room

### Important DB Patterns
- **UUIDv7**: Time-sortable IDs via `uuid_generate_v7()` function
- **Ticket Codes**: Auto-generated human-readable format `A-001`, `A-002`, ..., `B-001` (resets daily at midnight store timezone)
- **Store Settings**: JSONB field in `stores.settings` with nested queue config (accepting_tickets, timeouts, etc.)
- **Session Lifecycle**: `waiting` → `called` → `serving` → `finished` (or `missed`/`abandoned`)
- **Janitor Job**: `server/lib/janitor.ts`, not an n8n workflow. Abandons ghost sessions (no heartbeat for `queue.ghost_timeout_minutes`, default 30) and marks called-but-not-served as missed (`queue.called_timeout_minutes`, default 5). Runs lazily off real requests via `waitUntil()` behind an atomic `job_runs` lock, because Hobby crons only fire once a day

## API Structure

**No `:id` path parameters anywhere.** The id travels in the body (or the query string on
GET), which is the shape the n8n webhooks had and the frontend still speaks. Writing
`/sessions/:id/abandon` from memory gets a 404 with `"No route for ..."`. The routes below
are the real list; `server/routes/*.ts` is the source of truth.

### Client API (Prefix: `/api/v1/client`)
- `POST /sessions` - Create queue session (validates entry_point, checks store accepting_tickets)
- `GET /sessions?session_id=` - Session recovery (for page refresh)
- `POST /sessions/heartbeat` - Keep-alive (every 60s), `session_id` in the body
- `POST /sessions/abandon` - User leaves queue, `session_id` in the body
- `GET /marketing-cards` - Content feed for the waiting room
- `POST /chat/start` - Open (or resume) the concierge conversation
- `POST /chat/send` - One concierge turn

### Admin API (Prefix: `/api/v1/admin`)
Everything except `auth/verify` and `auth/stores` is behind `adminGuard`, declared *after*
those two on purpose. **`store_id` always comes from the session token**, never from the
request, even though the frontend still sends it.
- `POST /auth/verify` - PIN login (returns session_token)
- `GET /auth/stores` - List available stores (public endpoint)
- `GET /queue/status` - Full board: waiting, called, serving, counts
- `GET /queue/current` - Current queue state
- `POST /queue/call-next` - FIFO call with DB lock (`FOR UPDATE SKIP LOCKED`)
- `PATCH /sessions/status` - Move a session along its lifecycle
- `GET|PATCH /stores/settings` - Read/update store config (toggle queue on/off, etc.)
- `GET|POST /entry-points`, `DELETE /entry-points/delete`
- `GET|POST|PATCH|DELETE /marketing-cards`
- `POST /wiki/reload` - Re-read the bundled wiki
- `GET /usage` - AI spend against the monthly cap

### Standard Response Format
Every response goes through the same envelope (`server/lib/respond.ts`), inherited from the
n8n `SUB_Response_Standardizer`:
```json
{
  "success": true/false,
  "data": {...},
  "error": {"code": "...", "message": "..."},
  "meta": {"timestamp": "...", "request_id": "..."}
}
```

## File Structure & Workflow

### Documentation Hierarchy (in case of conflicts)
1. **specs/** - Technical specifications (source of truth)
   - `01_Vision_e_Business.md` - Vision, roadmap, MVP scope
   - `03_Architettura_Funzionale.md` - User flows, business rules
   - `04_Database.md` - Schema definitions, JSONB structures
   - `05_Infra_Architecture.md` - n8n workflows, API contracts
   - `06_Frontend_Apps.md` - UI specs, component guidelines
2. **project-board/PROTOCOLLO.md** - Task management workflow
3. **Code** - Physical implementation

### Project Board (Kanban)
Located in `project-board/`:
- `0_BACKLOG/` - Future ideas
- `1_TODO/` - Ready to work
- `2_IN_PROGRESS/` - Active work (lock: 1 task per agent)
- `3_PENDING_REVIEW/` - Awaiting approval
- `4_DONE/` - Completed
- `5_BLOCKED/` - Blocked tasks

Task files use frontmatter with ID, TASK, OWNER, STATUS, Acceptance Criteria.

### Code & Artifacts
- `pwa/` - React 19 + TS + Vite PWA (client + admin monolith), `npm install && npm run dev`
- `api/index.ts` + `server/` - the whole backend: one serverless function mounting a Hono app
- `scripts/` - maintenance run from a laptop, never at request time
- `database/kyros_schema.sql` - PostgreSQL 18.1 schema
- `knowledge/public/` - the concierge wiki, compiled into the bundle at prebuild

## Development Commands

Frontend (`pwa/`):
- Dev server: `cd pwa && npm run dev` (http://localhost:5173)
- Build: `cd pwa && npm run build`
- Lint: `cd pwa && npm run lint`

Root:
- `npm run typecheck` - tsc over server, scripts and api
- `npm test` - vitest
- `npm run db:apply` - apply `database/kyros_schema.sql`
- `npm run db:seed` - tenant, store, admin PIN, entry points, service points, content.
  Needs `KYROS_SEED_ADMIN_PIN` (4-6 digits). Idempotent
- `npm run db:cards` - reconcile only the content feed, no PIN needed. `-- --apply` to write
- `npm run smoke` - end-to-end checks against production

Deploy is `git push origin main`. Nothing else. Changing an env var needs a fresh deploy
before it takes effect.

## Critical Constraints (Extreme MVP)

1. **No Staff Management**: No `operators` table. Service is tracked by `service_point_id` (physical station), not individual people.

2. **No Image Management**: Zero `logo_url` or `image_url` fields. Branding uses:
   - CSS color themes (Deep Space #0F172A, Electric Teal #2DD4BF)
   - Lucide React icons (specify by name in `icon_name` field)
   - Text-only marketing cards

3. **FIFO Only**: Global chronological queue for the entire store. No priority, no routing logic (that's for Phase 2+).

4. **PIN-Based Access**: Admin Control Room uses simple 4-6 digit PIN stored in `admin_access` table. No user accounts, no passwords. Session stored in localStorage (8hr expiry).

5. **Queue Toggle**: Store can pause accepting new tickets via `stores.settings.queue.accepting_tickets = false`. Existing queue still gets served (draining mode).

## Frontend Guidelines

- **Monolith PWA**: Single React app with route-based separation (`/` for client, `/control-room` for admin)
- **Design System**:
  - Tailwind CSS utility classes
  - Glass Card components (semi-transparent blur)
  - Lucide icons only
  - Touch targets min 44x44px (mobile-first)
  - WCAG 2.1 AA compliance (4.5:1 contrast)
- **State Management**: Zustand for real-time queue state
- **Empty States**: Every screen handles zero-data elegantly (specific messages in specs)
- **Session Recovery**: localStorage persistence (`kyros_session` for client, `kyros_admin_session` for admin)

## Common Workflows

### Adding an API endpoint:
1. Pick the file: `server/routes/client.ts`, `admin.ts`, `chat.ts` or `internal.ts`
2. **No `:id` in the path.** Id in the body, or the query string on GET
3. Return through `ok()` / `fail()` from `server/lib/respond.ts`, never a bare `c.json()`
4. On admin routes take `store_id` from the session token, never from the request
5. Tagged template SQL only, never concatenation
6. `npm run typecheck && npm test`, then update CHANGELOG.md

### Modifying database schema:
1. Update `specs/04_Database.md` first (source of truth)
2. Modify `database/kyros_schema.sql`
3. Test migration path if altering existing tables
4. Verify indices still align with query patterns

### Adding UI component:
1. Check `specs/06_Frontend_Apps.md` for design specs and empty states
2. Use Tailwind CSS (no custom CSS unless absolutely necessary)
3. Use Lucide React icons (no image assets)
4. Ensure WCAG 2.1 AA compliance
5. Handle loading, error, and empty states

## Integration Notes

### The client discovers everything by polling
There are no push notifications and no websockets. `TICKET_CALLED`, `QUEUE_UPDATE` and
`ADMIN_DING` were named in the old specs but never implemented; a customer learns they have
been called on the next poll. Do not write code that waits for an event.

### Marketing card icons and themes are a closed set
`pwa/src/components/shared/MarketingCard.tsx` maps exactly four icons
(`Gift`, `Coffee`, `Star`, `Info`) and four themes (`purple`, `orange`, `blue`, `green`).
Anything else falls back silently to `Info` on `blue`, so a typo looks like a styling bug
rather than an error. The card list lives in `scripts/marketing-cards.ts`.

### Concierge AI
OpenRouter, model in `KYROS_AI_MODEL`, monthly cap in `KYROS_AI_BUDGET_EUR` acting as a hard
kill switch. The wiki it answers from is `knowledge/public/*.md`, compiled into
`server/lib/wiki.generated.ts` at prebuild. Chat is English only. Prompt caching does not
currently work (`cached_tokens: 0` on every call); accepted, costs cents.

## Reference Documents

- `specs/03_Architettura_Funzionale.md` - Complete user journeys (Client and Admin flows)
- `specs/04_Database.md` - JSONB structure details, index strategy
- `specs/05_Infra_Architecture.md` - All API endpoint specs with request/response examples
- `specs/06_Frontend_Apps.md` - UI mockups, accessibility requirements, empty states
- `CHANGELOG.md` - Project history and completed milestones

## Special Notes

- **Language**: Italian is default (`language: 'it'`) but codebase/comments should remain in English
- **Timezone**: Default `Europe/Rome` for all stores unless specified
- **Ticket Reset**: Automatic daily reset at midnight (store timezone)

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
