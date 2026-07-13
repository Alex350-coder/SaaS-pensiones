# Production image (Phase 18). Build the SPA, then serve the static bundle with
# an unprivileged nginx that also reverse-proxies `/api` and `/socket.io` to the
# API — so the browser talks to a single origin (no CORS, httpOnly cookies work
# cleanly) and the strict CSP is served with the HTML.

# ---- builder ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- runner (non-root nginx) ------------------------------------------------
# nginx-unprivileged runs as uid 101 and listens on 8080 (no root needed).
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
