# Stage 1: Build binary
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Install CA certs and build tools
RUN apk add --no-cache ca-certificates git

# Cache go modules
COPY go.mod go.sum* ./
RUN go mod download || true

# Copy source
COPY . .

# Ensure modules are resolved and build static binary
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/notification ./cmd/notification/main.go

# Stage 2: Minimal runtime
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /bin/notification /app/notification
COPY --from=builder /src/migrations /app/migrations

USER appuser

EXPOSE 8005

ENV APP_ENV=production \
    HTTP_PORT=8005

ENTRYPOINT ["/app/notification"]
