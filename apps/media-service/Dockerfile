FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN pnpm install -g turbo
COPY . .
RUN turbo prune media-service --docker

FROM base AS installer
WORKDIR /app
# Sharp ships prebuilt musl binaries; vips/libc6-compat cover edge builds.
RUN apk add --no-cache libc6-compat vips
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm --filter media-service db:generate
RUN pnpm turbo run build --filter=media-service... || true

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 honojs
USER honojs

COPY --from=installer --chown=honojs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=honojs:nodejs /app/packages ./packages
COPY --from=installer --chown=honojs:nodejs /app/apps/media-service ./apps/media-service

WORKDIR /app/apps/media-service

EXPOSE 8013

# Migrations run via `node dist/db/migrate.js` before start in deployments.
CMD ["node", "dist/server.js"]
