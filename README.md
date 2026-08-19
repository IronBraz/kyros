# Kyros — Queue Management for Retail

*Transform passive waiting into engaging customer journeys. Self-hostable, multi-tenant, source-available for the small and medium retail world.*

[![License: PolyForm-NC-1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Vercel](https://img.shields.io/badge/Vercel-serverless-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Status: MVP Phase 1](https://img.shields.io/badge/status-MVP%20Phase%201-green.svg)](#roadmap)

---

> ### Backend: migrazione da n8n a Vercel + Neon completata (2026-08-17)
>
> Il backend è una singola **funzione serverless TypeScript (Hono) su Vercel** con
> **Neon Postgres**. I 32 workflow n8n self-hosted sono spenti e archiviati.
>
> L'ultimo stato del codice prima della migrazione resta nel
> **tag [`v1.5.0-n8n-final`](../../releases/tag/v1.5.0-n8n-final)** e nel branch
> **`legacy/n8n`**. I file JSON dei workflow, invece, non sono più in git da nessuna
> parte: sono stati rimossi dall'intera storia il 2026-08-19, prima di rendere pubblico
> questo repository, perché contenevano l'indirizzo email personale dell'autore. I workflow
> restano archiviati e ripristinabili dentro l'istanza n8n che li eseguiva.
> Vedi `CHANGELOG.md` 2.0.0 per cosa è cambiato.

## What is Kyros?

Kyros is a **queue management and concierge platform** for retail stores. It replaces the passive "stand in line and hope" experience with a digital flow: customers scan a QR code at the entrance, get a ticket on their phone, watch the queue progress live, and receive a notification when it's their turn — all while the store's Control Room manages calls and capacity from a single screen.

The architecture is intentionally small: a React app on the front, a single serverless TypeScript function behind it, and a Postgres database. No message queue, no cache layer, no realtime service — the queue board polls, which is enough for a room with twenty people in it and one less thing to keep alive.

Designed for retail with **variable footfall**: workshops, parts counters, concierge desks, premium supermarkets, service desks at events. Multi-tenant from day one (one shared database, isolation by `tenant_id`).

## Key features

- **Digital QR / NFC ticketing** — customers join the queue from their phone, no app store install
- **NFC tag write-and-go** — admins can write entry-point tags from the Control Room
- **Live Control Room** — single-screen FIFO queue board for operators, refreshed by polling
- **AI concierge** — customers can ask the store anything while they wait. Answers come from
  the store wiki in `knowledge/public/`, baked into the bundle at build time, through
  OpenRouter with a hard monthly spend cap
- **Multi-tenant by design** — shared schema, tenant isolation, brand-per-store theming
- **PIN-based admin access** — no user accounts to provision, no passwords to forget.
  PINs are stored as scrypt hashes and rate limited; sessions are HMAC-signed tokens
- **Mobile-first web app** — works on any modern phone, nothing to install from a store
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
                    ┌────────────────▼────────────────┐
                    │        Vercel (region fra1)     │
                    ├─────────────────────────────────┤
                    │  Static: pwa/dist (React 19)    │
                    │  /api/*  ─▶ one Function        │
                    │            (Node + Hono)        │
                    └────────┬───────────────┬────────┘
                             │               │
                    ┌────────▼──────┐  ┌─────▼────────┐
                    │ Neon Postgres │  │  OpenRouter  │
                    │ (eu-central-1)│  │  (concierge) │
                    └───────────────┘  └──────────────┘
```

- **Frontend** — single React 19 PWA (`pwa/`), routed monolith: `/` for clients, `/control-room` for admins
- **Backend** — one serverless function (`api/index.ts`) mounting a Hono app (`server/`).
  A single function rather than a file per route: it keeps one bundle warm instead of many,
  stays inside the Vercel Hobby function limit, and gives real middleware (auth, rate
  limiting, validation) instead of the same checks copy-pasted into every handler.
- **Database** — Neon serverless Postgres, accessed over the HTTP driver: in serverless
  there is no process to hold a connection pool. Schema in `database/kyros_schema.sql`.
- **Same origin** — the SPA and the API share one host, so the frontend calls `/api/v1/*`
  relative and there is no CORS anywhere.

The previous backend was 32 n8n workflows self-hosted behind a Cloudflare Tunnel. The code
around them is frozen at [`v1.5.0-n8n-final`](../../releases/tag/v1.5.0-n8n-final). The
workflow JSON files themselves are no longer in git at any commit, branch or tag: they were
stripped from the whole history on 2026-08-19, before this repository was made public,
because they embedded the author's personal email address.

## Project structure

```
kyros/
├── README.md
├── LICENSE                    # PolyForm Noncommercial 1.0.0
├── CHANGELOG.md
├── CLAUDE.md                  # Architectural guide for AI assistants
├── api/index.ts               # Vercel entry point, mounts the Hono app
├── server/                    # The backend
│   ├── app.ts                 #   routing + global middleware
│   ├── routes/                #   client, chat, admin, internal
│   └── lib/                   #   db, auth, pin, ratelimit, janitor, openrouter, wiki
├── pwa/                       # React 19 + TS + Vite (client + admin monolith)
├── knowledge/public/          # Store wiki, baked into the bundle at build time
├── database/                  # Postgres schema
├── scripts/                   # db-apply, db-seed, db-cards, smoke, generate-wiki, dev-api
├── tests/                     # vitest unit tests
├── specs/                     # Technical specifications (Italian)
├── project-board/             # Kanban-style task board (markdown)
└── docs/
    └── Kyros_Overview.pdf     # Project overview / pitch deck
```

> Anything in `api/` that does not start with `_` becomes an HTTP function on Vercel, which
> is why the backend lives in `server/` at the root and `api/index.ts` is only a shim.

## Getting started

### Prerequisites
- Node.js 20+
- A Neon database (or any Postgres 12+) reachable via `DATABASE_URL`
- The Vercel CLI, if you want to run the API locally the way it runs in production

### 1. Install and configure

```bash
npm install
cp .env.example .env.local     # then fill in DATABASE_URL and KYROS_SESSION_SECRET
```

### 2. Database

```bash
npm run db:apply                        # applies database/kyros_schema.sql
KYROS_SEED_ADMIN_PIN=<pin> npm run db:seed
```

The PIN is never written to a file and only its scrypt hash reaches the database.

### 3. Run it

Two terminals, because the API and the SPA are separate processes in development while
sharing one origin in production:

```bash
./scripts/dev-api.ps1      # API on :3100
npm run dev                # SPA on :5173, proxying /api to :3100
```

### 4. Check it

```bash
npm test                                   # unit tests, no database needed
KYROS_SMOKE_PIN=<pin> npm run smoke        # full journey against a running deployment
```

## Roadmap

- **Phase 1 — MVP (done)** — Single-store FIFO, PIN auth, QR + NFC ticketing, Control Room, marketing feed, janitor jobs, daily reset, PWA monolith
- **Phase 1.5 — Pilot (done)** — AI concierge over the store wiki, budget cap, HTTPS on a real domain, server-side auth, serverless backend on Vercel + Neon
- **Phase 2 — Planned** — Multi-store routing, priority rules, push notifications, operator analytics
- **Phase 3 — Vision** — Voice calling, multi-language i18n

Known gaps, stated on purpose: no monitoring or alerting, no backups beyond Neon's
point-in-time recovery, and the customer's browser learns everything by polling — there is
no websocket and no push.

## Documentation

- [`specs/`](specs/) — Full technical specifications (10 documents, in Italian)
- [`docs/Kyros_Overview.pdf`](docs/Kyros_Overview.pdf) — Project overview / pitch deck
- [`CHANGELOG.md`](CHANGELOG.md) — Release history
- [`CLAUDE.md`](CLAUDE.md) — Architectural cheat sheet for AI coding assistants
- [`project-board/`](project-board/) — Kanban-style task tracking

> **Language note**: technical specifications and the changelog are in Italian (the language of the original project notes). README, code, and code comments are in English.

## License

Released under the [PolyForm Noncommercial License 1.0.0](LICENSE) — **source-available, not OSI open-source**. You may use, modify, and distribute Kyros for any **noncommercial** purpose, provided attribution is preserved. **Commercial use requires explicit permission from the author** — please reach out.

## Author

**Gualtiero Brazzelli** — [@IronBraz](https://github.com/IronBraz)

Kyros is one of my first end-to-end projects: from data model to PWA, with a heavy focus on getting a real product into production rather than chasing perfection. If you find it useful, are curious about the architecture, or want to discuss commercial use, get in touch.
