# ==============================================================================
# Larekmart - Analytic Service (Go) Dockerfile
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BUILDER_IMAGE=golang:1.22-alpine
ARG RUNNER_IMAGE=alpine:3.20
# For enterprise DHI environments:
#   docker build --build-arg BUILDER_IMAGE=dhi.io/golang:1.22 --build-arg RUNNER_IMAGE=dhi.io/alpine:3.20 .

# Stage 1: Build static binary
FROM ${BUILDER_IMAGE} AS builder

WORKDIR /src

# Install CA certs and build tools
RUN apk add --no-cache ca-certificates git

# Cache go modules
COPY go.mod go.sum* ./
RUN go mod download

# Copy source
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/analytics ./cmd/analytics/main.go

# Stage 2: Minimal hardened runtime
FROM ${RUNNER_IMAGE} AS runner

RUN apk add --no-cache ca-certificates tzdata

# Security: Run as unprivileged system user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /bin/analytics /app/analytics
COPY --from=builder --chown=appuser:appgroup /src/migrations /app/migrations

USER appuser

EXPOSE 8004

ENV APP_ENV=production \
    PORT=8004

ENTRYPOINT ["/app/analytics"]
