# Dev image: single stage, runs migrations + grants before starting.
# Production multi-stage image is a Phase 18 deliverable.
FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm db:generate

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

EXPOSE 3000

CMD ["sh", "-c", "pnpm db:deploy && pnpm db:grants && node dist/main.js"]
