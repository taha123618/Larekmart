FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN pnpm install -g turbo
COPY . .
RUN turbo prune email-service --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=email-service... || true

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejsuser
USER nodejsuser

COPY --from=installer --chown=nodejsuser:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=nodejsuser:nodejs /app/packages ./packages
COPY --from=installer --chown=nodejsuser:nodejs /app/apps/email-service ./apps/email-service

WORKDIR /app/apps/email-service

CMD ["node", "--import", "tsx", "src/index.ts"]
