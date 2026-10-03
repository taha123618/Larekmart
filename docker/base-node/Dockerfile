# ==============================================================================
# Larekmart - Base Node Build Image
# Pre-installs pnpm and turbo once for all microservice build stages.
# ==============================================================================
ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PNPM_HOME:$PATH"
ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN apk add --no-cache libc6-compat && \
    npm install -g pnpm@9.0.0 turbo
