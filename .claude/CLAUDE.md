# CLAUDE.md

> Project context for Claude Code. Strategy docs live in `docs/`:
> [contexto.md](../docs/contexto.md) (vision, scope, **current phase**),
> [roadmap.md](../docs/roadmap.md), [arquitectura.md](../docs/arquitectura.md),
> [database-design.md](../docs/database-design.md), [security.md](../docs/security.md),
> [ui-ux.md](../docs/ui-ux.md).

## Project

**Pensiones** — SaaS platform for managing restaurant meal-plan subscriptions
("pensiones"): restaurants publish daily menus; clients contract 30-day pensions,
reserve daily meals, confirm attendance, and chat with the restaurant admin.
Portfolio project — production-grade architecture, docs, and standards.
UI copy is Spanish; code, comments, and commits are English.

**Roles:** Cliente (browse restaurants/menus, contract pension, reserve, confirm
attendance, chat) · Restaurant Admin (manage restaurant, menus, pensioners,
payments, reservations, attendance, notices, simulated invoices) · Super Admin
(approve/suspend restaurants, manage users/system).

## Mandatory workflow (phase-driven)

ALWAYS at session start:

1. Read `docs/contexto.md` → identify the **current phase**.
2. Execute ONLY that phase. Never skip phases.
3. Update docs, advance the phase state in `contexto.md`, then continue.

Order is strict: **database → backend → frontend**. No code before the strategy
docs in `docs/` exist (Phase 0 = planning + documentation). Full phase list
(1 DB design → 18 production prep) lives in `docs/roadmap.md`.

## Stack (mandatory — do not substitute)

- **Frontend:** React + TypeScript + Vite, TailwindCSS, shadcn/ui, TanStack Query,
  React Hook Form + Zod, Zustand. Package manager: **pnpm only**.
- **Backend:** NestJS + TypeScript, JWT auth (access + refresh, rotation), RBAC.
- **DB:** PostgreSQL (preferred) via Prisma ORM. Docker + Docker Compose for infra.
- **Realtime:** WebSockets (chat pensioner ↔ restaurant admin, notices).

## Architecture principles

Clean/Hexagonal Architecture, SOLID, DRY, KISS, Separation of Concerns,
Dependency Injection, Composition over Inheritance, DDD where appropriate.
Bounded contexts and diagrams are defined in `docs/arquitectura.md`.

## DRY policy (mandatory)

Never duplicate code when a reasonable abstraction exists. Before creating
components, services, hooks, DTOs, utilities, validations, queries, or
mutations — search for an existing reusable implementation first. Prioritize
reuse, extensibility, and maintainability over quick solutions.

## Security (from day one — see docs/security.md)

JWT + refresh tokens, RBAC guards, bcrypt hashing, DTO/input validation +
sanitization on every endpoint, rate limiting, XSS/CSRF/SQL-injection
protection, basic audit trail. Never commit `.env`, credentials, or API keys.

## UI/UX

Extremely high priority — premium SaaS look, use the `ui-ux-pro-max` skill for
design work. Design system in `docs/ui-ux.md`.

- Palette base: `#1F363D` `#40798C` `#70A9A1` `#9EC1A3` `#CFE0C3` — derive
  tints/shades, hover/active/disabled states, and dark mode from these tokens.
- Restaurant cards: modern SaaS style — hover animations, subtle glassmorphism,
  dynamic elevation, reveal/expand microinteractions (menu, hours, location,
  availability on click).
- Admin dashboard metrics: active pensioners, pending payments, today's
  reservations, projected attendance, estimated revenue.

## Testing

Unit + integration + E2E. Minimum coverage: **80%**. TDD workflow
(test first → implement → refactor). Run tests/lint before calling work done;
if a change has no test coverage, say so explicitly.

## Rules

- ES modules, functional components + hooks, no `any` without a justifying comment.
- `camelCase` variables/functions, `PascalCase` components/types, `kebab-case`
  filenames (React component files are `PascalCase.tsx`).
- User-facing error messages in Spanish; error `code`s are stable English slugs.
- Consistent API envelope: `{ success, data, error }`; paginated lists include meta.
- Commits in English, short imperative (`Add pension checkout flow`). No `git push`
  or PRs unless explicitly asked.

## Final phase gates (before "done")

Run security, architecture, code, performance, and refactoring review agents;
produce `security-report.md`, `architecture-review.md`, `code-review.md`,
`performance-report.md`.

## Gotchas

- Windows dev machine; PowerShell 5.1 (no `&&` chaining).
- Invoicing is **simulated** initially, but architect for real emission later
  (numbering, PDF, history).
- Pensions run exactly 30 days: track start/end dates, days remaining, status,
  payments. Daily attendance confirmation (asistiré / no asistiré) feeds the
  restaurant's production projection.
