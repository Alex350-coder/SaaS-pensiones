# Pensiones — Restaurant Meal-Plan SaaS

A production-grade portfolio project: a SaaS platform for managing restaurant
**meal-plan subscriptions** ("pensiones"). Restaurants publish daily menus;
clients contract a 30-day pension, reserve daily meals, confirm attendance, and
chat with the restaurant in real time. Super Admins curate the marketplace.

Built to demonstrate realistic architecture, security, and testing — not a toy.
The UI copy is Spanish; the code, comments, and commits are English.

---

## Highlights

- **Clean/Hexagonal modular monolith** (NestJS) with 8 bounded contexts, pure
  domain layers, and port/adapter seams (`InvoiceIssuer`, `NotificationPusher`,
  `SessionTerminator`) — **zero import cycles**.
- **Security from day one** (OWASP-aligned): JWT access + rotating refresh with
  family-revocation, RBAC deny-by-default, per-resource ownership checks,
  parameterized SQL, atomic gap-free invoice numbering, WebSocket handshake auth.
- **httpOnly-cookie auth + CSRF double-submit** — no tokens in `localStorage`.
- **Realtime** chat + notifications over Socket.IO, force-disconnected on
  logout/suspension.
- **Premium SPA** (React + Vite + Tailwind + shadcn/ui) with three surfaces
  (public site, client app, restaurant/admin dashboard), dark mode, and WCAG-AA
  accessibility.
- **~96% backend coverage**, Vitest component/logic coverage, and Playwright
  E2E across the critical flows.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite, TailwindCSS, shadcn/ui, TanStack Query, React Hook Form + Zod, Zustand |
| Backend | NestJS + TypeScript, JWT (access + rotating refresh), RBAC, `@nestjs/throttler`, Helmet |
| Database | PostgreSQL 16 via Prisma ORM (least-privilege runtime role) |
| Realtime | WebSockets (Socket.IO over a NestJS gateway) |
| Infra | Docker + Docker Compose, nginx (SPA + same-origin reverse proxy) |
| Package manager | pnpm |

## Architecture at a glance

```
                    ┌────────────── nginx (prod) ──────────────┐
   browser ───────► │  /            → static SPA (Vite build)   │
   (one origin)     │  /api         → api:3000  (NestJS)        │
                    │  /socket.io   → api:3000  (WebSocket)     │
                    └───────────────────┬──────────────────────┘
                                        │
                         NestJS modular monolith (hexagonal)
   Identity · Catalog · Menu · Pensions · Reservations · Communication
                     · Analytics · Billing (simulated)
                                        │
                              PostgreSQL 16 (Prisma)
```

Bounded contexts depend only through exported application services and DI
ports; domain layers carry no framework imports. Details in
[`docs/arquitectura.md`](docs/arquitectura.md).

## Security posture

- **Auth:** short-lived JWT access (15 min) + opaque refresh (7 d, SHA-256
  hashed) with rotation and **family revocation on reuse**. Tokens are delivered
  as **httpOnly cookies** (never readable by JS); a readable `csrf_token` powers
  **double-submit CSRF** protection on mutating requests. A `Bearer` header is
  accepted as a programmatic-client fallback.
- **Transport/headers:** Helmet (HSTS, `X-Frame-Options: DENY`, nosniff,
  referrer policy); a strict, `'self'`-based **CSP** served with the SPA by
  nginx; CORS allow-list (defense-in-depth — the prod topology is same-origin).
- **AuthZ:** RBAC deny-by-default + ownership checks in every use case; adversarial
  E2E tests cover IDOR and vertical escalation.
- **Data:** parameterized SQL only, immutable invoices with atomic correlative
  numbering, append-only audit log, least-privilege DB runtime role.

Threat model and controls: [`docs/security.md`](docs/security.md) ·
audit: [`docs/security-report.md`](docs/security-report.md).

## Running it

### Prerequisites

- Docker + Docker Compose
- (For local dev without Docker) Node ≥ 20 and `pnpm`

### Development (Docker Compose: db + api, SPA via Vite)

```bash
docker compose up -d --build          # Postgres + API on :3000
pnpm -C backend db:seed               # idempotent demo data (optional)
pnpm -C frontend dev                  # SPA on :5173 (proxies /api + /socket.io)
```

Open http://localhost:5173.

### Production (Postgres + API + nginx, single origin)

```bash
cp .env.prod.example .env.prod        # then fill in real secrets
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build
```

Open http://localhost (nginx serves the SPA and reverse-proxies the API).
Set `COOKIE_SECURE=true` and serve over HTTPS in a real deployment; for a local
plain-http smoke test keep `COOKIE_SECURE=false`.

### Tests

```bash
# Backend: unit + e2e (needs the DB up) + combined coverage gate (80/70)
pnpm -C backend test
pnpm -C backend test:e2e
pnpm -C backend test:cov:check

# Frontend: unit/component (Vitest)
pnpm -C frontend test

# End-to-end (Playwright, against the running stack)
pnpm test:e2e
```

## Key decisions & trade-offs

- **Cookie auth over Bearer-in-`localStorage`:** closed the standing XSS
  refresh-token-theft risk (former code-review C-1) by moving to httpOnly
  cookies + CSRF; a same-origin nginx proxy keeps cookies simple and removes
  browser CORS entirely.
- **Simulated invoicing behind a port:** correct correlative numbering and PDF
  today; a real emitter swaps in without touching the domain.
- **Modular monolith, not microservices:** the right altitude for the scope —
  bounded contexts give the seams; distribution would be premature.
- **Money as `numeric(10,2)`; lock-guarded paths compare in integer cents** — a
  documented, accepted limitation (see [`docs/performance-report.md`](docs/performance-report.md)).

## Project docs

| Doc | Contents |
|-----|----------|
| [contexto.md](docs/contexto.md) | Vision, scope, phase state, progress log |
| [roadmap.md](docs/roadmap.md) | The 18 phases with exit criteria |
| [arquitectura.md](docs/arquitectura.md) | Bounded contexts, diagrams, flows |
| [database-design.md](docs/database-design.md) | Entities, constraints, migrations |
| [security.md](docs/security.md) | Threat model, OWASP coverage, controls |
| [ui-ux.md](docs/ui-ux.md) | Design system, palette, accessibility |
| [security-report.md](docs/security-report.md) · [code-review.md](docs/code-review.md) · [architecture-review.md](docs/architecture-review.md) · [performance-report.md](docs/performance-report.md) | Review artifacts |

## Screenshots

_Add captures of the landing page, restaurant catalog, client pension view, and
the restaurant dashboard here._

<!-- ![Landing](docs/screenshots/landing.png) -->
