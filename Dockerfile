# ── Stage 1: base ──────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# ── Stage 2: deps ──────────────────────────────────────────────
FROM base AS deps

# Copy all package.json files + lockfile for dependency resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/cli/package.json ./packages/cli/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 3: builder ──────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/ ./
COPY . .

# Placeholder env vars needed at build time (Next.js inlines NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV TURSO_DATABASE_URL=http://localhost:8080
ENV TURSO_AUTH_TOKEN=
ENV GITHUB_CLIENT_ID=placeholder
ENV GITHUB_CLIENT_SECRET=placeholder
ENV BETTER_AUTH_SECRET=placeholder
ENV BETTER_AUTH_URL=http://localhost:3000
ENV STRIPE_SECRET_KEY=placeholder
ENV STRIPE_PUBLISHABLE_KEY=placeholder
ENV STRIPE_WEBHOOK_SECRET=placeholder
ENV STRIPE_EXTRA_SEAT_PRICE_ID=placeholder

RUN pnpm turbo build --filter=@memctl/web

# ── Stage 4: runner ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
