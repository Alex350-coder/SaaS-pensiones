# Pensiones — Frontend (SPA)

Public web app for the Pensiones platform (Phase 12: public surface). React +
TypeScript + Vite, TailwindCSS with shadcn/ui-style primitives, TanStack Query,
React Hook Form + Zod, and Zustand for session/theme.

## Requirements

- Node ≥ 20, **pnpm** (the only supported package manager)
- The backend running on `http://localhost:3000` (see repo root `docker-compose.yml`)

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

The dev server proxies `/api` → `http://localhost:3000` (the backend does not
enable CORS yet — deferred to Phase 18). Override the target with
`VITE_API_PROXY_TARGET` (see `.env.example`).

Seed demo data first (from `../backend`): `pnpm db:seed`. Any user logs in with
`Password123!`.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Vite dev server with API proxy |
| `pnpm build` | Type-check (`tsc -b`) + production build |
| `pnpm preview` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm test` | Vitest unit/component suite |

## Structure

```
src/
├── app/            # App shell: providers + router (route-level code splitting)
├── components/
│   ├── ui/         # Design-system primitives (Button, Input, Card, Badge…)
│   ├── forms/      # RHF field wrappers (TextField, PasswordField)
│   ├── layout/     # Header, Footer, PublicLayout, ThemeToggle
│   ├── shared/     # CoverImage, StateMessage/ErrorState
│   └── brand/      # Logo
├── features/       # Feature slices: auth, restaurants, menus (api + hooks + UI)
├── hooks/          # Cross-cutting hooks (useDocumentTitle)
├── lib/            # api-client (envelope + refresh), api-types, format, utils
├── pages/          # Route pages (Landing, Catalog, Detail, Login, Register, 404)
├── stores/         # Zustand: session (persisted) + theme (light/dark/system)
└── styles/         # tokens.css (design tokens) + global.css
```

## Design system

Visual source of truth is `../docs/ui-ux.md`, materialized in
`src/styles/tokens.css` (light + dark, both AA-verified) and `tailwind.config.ts`.
Direction: "Calma premium" — dimensional depth, subtle glass, designed
hover/focus/active states, reduced-motion honored globally.

## State ownership

- **Server state** (restaurants, menus): TanStack Query — never duplicated.
- **Session + UI** (user, tokens, theme): Zustand (session persisted).
- **Shareable state** (catalog page): URL search params.
- **Forms**: React Hook Form + Zod schemas.
