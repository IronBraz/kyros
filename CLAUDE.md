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
- **Backend**: n8n workflows (self-hosted, Docker-based)
- **Database**: PostgreSQL 18.1 (UUIDv7, JSONB for flexible config)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Zustand
- **Real-time**: Socket.io
- **Proxy**: Caddy (reverse proxy, HTTPS, static assets)
- **Infrastructure**: NeuroForge Docker Compose stack on Linux VPS

### Key Architecture Decisions
- **Multi-tenancy**: Shared database, shared schema (tenant_id/store_id columns)
- **Monolith Frontend**: Single React PWA serves both Client and Admin interfaces (routes differentiate)
- **Service Points (not Staff)**: Queue activity tracked by physical "Cassa" (checkout counter), not individual operators
- **FIFO Global**: All service points pull from a single store-wide queue in chronological order

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
- **Janitor Job**: Background n8n workflow cleans ghost sessions (no heartbeat for 15min) and marks called-but-not-served as missed (5min)

## API Structure

### Client API (Prefix: `/api/v1/client`)
- `POST /sessions` - Create queue session (validates entry_point, checks store accepting_tickets)
- `GET /sessions/:id` - Session recovery (for page refresh)
- `POST /sessions/:id/heartbeat` - Keep-alive (every 60s)
- `POST /sessions/:id/abandon` - User leaves queue

### Admin API (Prefix: `/api/v1/admin`)
- `POST /auth/verify` - PIN login (returns session_token)
- `GET /auth/stores` - List available stores (public endpoint)
- `POST /queue/call-next` - FIFO call with DB lock (`FOR UPDATE SKIP LOCKED`)
- `GET /queue/current` - Current queue state
- `PATCH /stores/:id/settings` - Update store config (toggle queue on/off, etc.)

### Standard Response Format
All n8n workflows use `SUB_Response_Standardizer` for consistent responses:
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
- `n8n/` - n8n workflow JSON exports (24+ workflows: client API, admin API, sub-workflows, jobs)
- `database/kyros_schema.sql` - PostgreSQL 18.1 schema

## Development Commands

For the frontend (`pwa/`):
- Dev server: `cd pwa && npm run dev` (http://localhost:5173)
- Build: `cd pwa && npm run build`
- Lint: `cd pwa && npm run lint`
- Preview: `cd pwa && npm run preview`

For n8n workflows:
- Edit via n8n web UI (typically http://localhost:5678)
- Export workflows as JSON to `n8n/`

For database:
- Schema location: `database/kyros_schema.sql`
- Apply schema: `psql -U <user> -d <database> -f database/kyros_schema.sql`

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

### Adding a new n8n API endpoint:
1. Check `specs/05_Infra_Architecture.md` for standard response format
2. Use `SUB_Response_Standardizer` sub-workflow
3. Validate multi-tenant isolation (always filter by `store_id` or `tenant_id`)
4. Export workflow JSON to `n8n/`
5. Update CHANGELOG.md

### Modifying database schema:
1. Update `specs/04_Database.md` first (source of truth)
2. Modify `database/kyros_schema.sql`
3. Test migration path if altering existing tables
4. Update affected n8n workflows
5. Verify indices still align with query patterns

### Adding UI component:
1. Check `specs/06_Frontend_Apps.md` for design specs and empty states
2. Use Tailwind CSS (no custom CSS unless absolutely necessary)
3. Use Lucide React icons (no image assets)
4. Ensure WCAG 2.1 AA compliance
5. Handle loading, error, and empty states

## Integration Notes

### n8n Workflow Development
The project uses Claude (via n8n-MCP integration) for n8n workflow implementation. The methodology is:
1. Deep context analysis (read PRD/SPECS)
2. Direct implementation in n8n platform (zero manual trial-error)
3. Workflows are exported as JSON to `n8n/`

Key n8n sub-workflows:
- `SUB_Auth_Manager` - JWT session handling
- `SUB_Socket_Emitter` - Real-time event broadcasting
- `SUB_Response_Standardizer` - Standard HTTP response format

### Real-time Events (Socket.io)
Socket events triggered by n8n workflows:
- `TICKET_CALLED` - Notify specific client their turn is up
- `QUEUE_UPDATE` - Broadcast new queue positions to all clients in store
- `ADMIN_DING` - Sound/visual alert for service desk

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
