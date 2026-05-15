# Kyros — Queue Management for Retail

*Transform passive waiting into engaging customer journeys. Self-hostable, multi-tenant, built for the small and medium retail world.*

[![License: PolyForm-NC-1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18.1-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![n8n](https://img.shields.io/badge/n8n-workflows-EA4B71?logo=n8n&logoColor=white)](https://n8n.io/)
[![Status: MVP Phase 1](https://img.shields.io/badge/status-MVP%20Phase%201-green.svg)](#roadmap)

---

## What is Kyros?

Kyros is a **queue management and concierge platform** for retail stores. It replaces the passive "stand in line and hope" experience with a digital flow: customers scan a QR code at the entrance, get a ticket on their phone, watch the queue progress live, and receive a notification when it's their turn — all while the store's Control Room manages calls and capacity from a single screen.

The architecture is intentionally **modest and self-hostable**: a React PWA on the front, n8n workflows as the backend (no custom Node/Express server to maintain), PostgreSQL 18 for storage, Caddy as the reverse proxy. No external SaaS dependencies — you run the whole stack on a single VPS.

Designed for retail with **variable footfall**: workshops, parts counters, concierge desks, premium supermarkets, service desks at events. Multi-tenant from day one (one shared database, isolation by `tenant_id`).

## Key features

- **Digital QR / NFC ticketing** — customers join the queue from their phone, no app install
- **Real-time Control Room** — single-screen FIFO queue board for operators
- **Multi-tenant by design** — shared schema, tenant isolation, brand-per-store theming
- **PIN-based admin access** — no user accounts to provision, no passwords to forget
- **Progressive Web App** — installable, works on any modern phone, offline shell
- **Daily auto-reset** — ticket codes restart every midnight in the store's timezone
- **Janitor jobs** — automatic cleanup of ghost sessions and missed calls
- **Marketing content feed** — push messages, offers, or branding to the waiting room
- **Service-point model** — track activity by physical station ("Cassa 1") instead of individual operators (privacy-friendly)
- **WCAG 2.1 AA** accessible UI

## Architecture

```
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │  Client PWA  │   │  Admin PWA   │   │  QR / NFC    │
   │      /       │   │ /control-room│   │ entry points │
   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
          │                  │                  │
          └────── HTTPS ─────┴───────┬──────────┘
                                     │
                            ┌────────▼────────┐
                            │     Caddy       │
                            │ (reverse proxy) │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │   n8n (REST)    │
                            │  /api/v1/...    │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │ PostgreSQL 18   │
                            │ (UUIDv7+JSONB)  │
                            └─────────────────┘
```

- **Frontend** — single React 19 PWA (`pwa/`), routed monolith: `/` for clients, `/control-room` for admins
- **Backend** — n8n workflow exports (`n8n/`), 24+ workflows covering Client API, Admin API, sub-workflows, and background jobs
- **Database** — PostgreSQL 18.1 schema with UUIDv7 IDs and JSONB for flexible store settings (`database/`)
- **Proxy** — Caddy in front, terminating HTTPS and routing `/api/*` to n8n, everything else to the PWA bundle

## Project structure

```
kyros/
├── README.md
├── LICENSE                    # PolyForm Noncommercial 1.0.0
├── CHANGELOG.md
├── CLAUDE.md                  # Architectural guide for AI assistants
├── pwa/                       # React 19 + TS + Vite PWA (client + admin monolith)
├── n8n/                       # 24+ workflow JSON exports
├── database/                  # PostgreSQL 18 schema + utility scripts
├── specs/                     # Technical specifications (Italian)
├── project-board/             # Kanban-style task board (markdown)
└── docs/
    └── Kyros_Overview.pdf     # Project overview / pitch deck
```

## Getting started

### Prerequisites
- Node.js 20+
- Docker (for n8n)
- PostgreSQL 18.1+
- Caddy (production only)

### 1. Database

```bash
createdb -U postgres kyros
psql -U postgres -d kyros -f database/kyros_schema.sql
```

See [`database/README.md`](database/README.md) for details.

### 2. n8n workflows

Spin up an n8n instance (self-hosted, Docker recommended), create a Postgres credential named `postgres-kyros-cred` pointing to your database, then import the workflows from `n8n/` in the order documented in [`n8n/README.md`](n8n/README.md).

### 3. PWA

```bash
cd pwa
npm install
npm run dev
```

Default dev URL: `http://localhost:5173`. See [`pwa/README.md`](pwa/README.md) for production build and Caddy snippet.

## Roadmap

- **Phase 1 — MVP (done)** — Single-store FIFO, PIN auth, QR ticketing, Control Room, marketing feed, janitor jobs, daily reset, PWA monolith
- **Phase 1.5 — In progress** — HTTPS deploy, end-to-end tests, deploy automation
- **Phase 2 — Planned** — Multi-store routing, AI-driven priority, push notifications, operator analytics dashboards
- **Phase 3 — Vision** — NFC integration, voice calling, multi-language i18n, AI concierge layer

## Documentation

- [`specs/`](specs/) — Full technical specifications (10 documents, in Italian)
- [`docs/Kyros_Overview.pdf`](docs/Kyros_Overview.pdf) — Project overview / pitch deck
- [`CHANGELOG.md`](CHANGELOG.md) — Release history
- [`CLAUDE.md`](CLAUDE.md) — Architectural cheat sheet for AI coding assistants
- [`project-board/`](project-board/) — Kanban-style task tracking

> **Language note**: technical specifications and the changelog are in Italian (the language of the original project notes). README, code, and code comments are in English.

## License

Released under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use, modify, and distribute Kyros for any **noncommercial** purpose, provided attribution is preserved. **Commercial use requires explicit permission from the author** — please reach out.

## Author

**Gualtiero Brazzelli** — [@IronBraz](https://github.com/IronBraz)

Kyros is one of my first end-to-end projects: from data model to PWA, with a heavy focus on getting a real product into production rather than chasing perfection. If you find it useful, are curious about the architecture, or want to discuss commercial use, get in touch.
