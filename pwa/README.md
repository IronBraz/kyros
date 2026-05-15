# Kyros PWA

Single React 19 + TypeScript + Vite Progressive Web App that serves both the **Client** queue interface and the **Admin** Control Room from one bundle, distinguished by route.

## Routes

- **`/`** — Client interface (QR landing, ticket creation, waiting room, your-turn screen)
- **`/control-room`** — Admin Control Room (PIN gate, queue board, session management, marketing cards CRUD, store settings)

## Tech stack

- **React 19** + **TypeScript 5.8**
- **Vite 6** (dev server + build)
- **Tailwind CSS 4** (styling, glassmorphism utilities)
- **Zustand 5** (state management for real-time queue)
- **React Router 7** (client/admin route split)
- **lucide-react**, **html5-qrcode**, **qrcode**, **recharts**

## Development

```bash
# Install dependencies
npm install

# Dev server (http://localhost:5173)
npm run dev

# Lint
npm run lint

# Production build (TypeScript check + Vite bundle)
npm run build

# Preview production build locally
npm run preview
```

## Environment variables

The PWA reads its `.env` from the **repo root** (one level up), not from `pwa/`. This is configured via `envDir: '..'` in `vite.config.ts`, so a single `.env` file at the root of the monorepo serves both the PWA and the database PowerShell scripts.

Copy `../.env.example` to `../.env` and fill in your values. Vite-exposed variables must use the `VITE_` prefix:

- `VITE_QR_BASE_URL` — base URL where QR-code landing pages resolve (used by Control Room preview). Example: `https://kyros.example.com`

## API integration

The PWA expects the n8n backend to be reachable on the same origin under `/api/v1/*`. In development this is achieved via the Vite dev proxy (`vite.config.ts`); in production via Caddy reverse proxy (see snippet below).

## Caddy reverse proxy (production)

```caddyfile
yourdomain.example {
  # API routes -> n8n backend
  handle /api/* {
    reverse_proxy localhost:5678
  }

  # SPA fallback for React Router
  handle {
    root * /var/www/kyros/pwa/dist
    try_files {path} /index.html
    file_server
  }
}
```

## Build output

Bundle ~1070 KB (~316 KB gzipped) with Vite-default code splitting.
