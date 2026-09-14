# Multi-stage production Dockerfile for inventory-service
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.0.0
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/inventory-service ./apps/inventory-service
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
RUN pnpm --filter @repo/types build 2>/dev/null || true
RUN pnpm --filter @repo/monitoring build 2>/dev/null || true
RUN pnpm --filter @repo/kafka build 2>/dev/null || true
RUN pnpm --filter @repo/redis build 2>/dev/null || true
RUN pnpm --filter @repo/inventory-db db:generate
RUN pnpm --filter inventory-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8007

RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/inventory-service/package.json ./apps/inventory-service/
RUN pnpm install --prod --frozen-lockfile
RUN pnpm --filter @repo/inventory-db db:generate

COPY --from=builder /app/apps/inventory-service/dist ./apps/inventory-service/dist

USER node
EXPOSE 8007

CMD ["node", "apps/inventory-service/dist/index.js"]
