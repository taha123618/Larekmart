FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN pnpm install -g turbo
COPY . .
RUN turbo prune inventory-service --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm --filter @repo/inventory-db db:generate
RUN pnpm turbo run build --filter=inventory-service... || true

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 honojs
USER honojs

COPY --from=installer --chown=honojs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=honojs:nodejs /app/packages ./packages
COPY --from=installer --chown=honojs:nodejs /app/apps/inventory-service ./apps/inventory-service

WORKDIR /app/apps/inventory-service

EXPOSE 8007
CMD ["node", "--import", "tsx", "src/index.ts"]
