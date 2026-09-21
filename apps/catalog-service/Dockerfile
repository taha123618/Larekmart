FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN pnpm install -g turbo
COPY . .
RUN turbo prune catalog-service --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm --filter @repo/catalog-db db:generate
RUN pnpm turbo run build --filter=catalog-service...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastifyjs
USER fastifyjs

# The internal @repo/* packages are consumed as TypeScript sources (their package
# `exports` point at ./src/*.ts), so a compiled dist/ cannot run under plain node:
# it would fail to resolve the workspace packages at runtime. The runtime image
# therefore keeps the workspace layout and runs the sources through tsx.
COPY --from=installer --chown=fastifyjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=fastifyjs:nodejs /app/packages ./packages
COPY --from=installer --chown=fastifyjs:nodejs /app/apps/catalog-service ./apps/catalog-service

WORKDIR /app/apps/catalog-service

EXPOSE 8010
CMD ["node", "--import", "tsx", "src/index.ts"]
