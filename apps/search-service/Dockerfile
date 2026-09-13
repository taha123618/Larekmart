# Multi-stage production Dockerfile for search-service
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.0.0
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/search-service ./apps/search-service
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
RUN pnpm --filter @repo/types build 2>/dev/null || true
RUN pnpm --filter @repo/monitoring build 2>/dev/null || true
RUN pnpm --filter @repo/kafka build 2>/dev/null || true
RUN pnpm --filter search-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8006

RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/search-service/package.json ./apps/search-service/
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/apps/search-service/dist ./apps/search-service/dist

USER node
EXPOSE 8006

CMD ["node", "apps/search-service/dist/server.js"]
