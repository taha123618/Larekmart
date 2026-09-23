FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN pnpm install -g turbo
COPY . .
RUN turbo prune shipping-service --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm --filter @repo/shipping-db db:generate
RUN pnpm turbo run build --filter=shipping-service...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 koajs
USER koajs

COPY --from=installer --chown=koajs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=koajs:nodejs /app/packages ./packages
COPY --from=installer --chown=koajs:nodejs /app/apps/shipping-service ./apps/shipping-service

WORKDIR /app/apps/shipping-service

EXPOSE 8011
CMD ["node", "--import", "tsx", "src/index.ts"]
