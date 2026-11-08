# AGENTS.md — apps/chat-service

Scope: `apps/chat-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 + TypeScript microservice running on port 8026 with PostgreSQL (Drizzle ORM), Redis, Socket.IO (with `@socket.io/redis-adapter`), and Kafka.
It provides real-time buyer-to-seller messaging, live customer-to-support agent communications, conversation history, participant management, typing indicators, presence tracking, read receipts, and safety moderation (reporting and blocking).

**Crucial Separation of Concerns:**

- `chat-service`: Owns live message transport, real-time Socket.IO rooms, message transcripts, read receipts, and user blocks.
- `support-service`: Owns support ticket state, SLAs, queues, and escalation policies.
- `media-service`: Owns media file uploads and variant processing.

## Architecture & Layers

- `src/index.ts` — Fastify 5 server bootstrap, Socket.IO gateway initialization with Redis adapter, and graceful shutdown.
- `src/config/env.ts` — Zod validated configuration (`PORT=8026`, `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `INTERNAL_SERVICE_SECRET`).
- `src/db/` —
  - `schema.ts`: Drizzle ORM schema for PostgreSQL (`conversations`, `conversation_participants`, `messages`, `message_receipts`, `message_attachments`, `conversation_blocks`).
  - `connection.ts`: `drizzle(pool)` connection factory with health query.
  - `migrate.ts`: Auto-migration runner executing Drizzle DDL statements.
  - `seed.ts`: Deterministic seed script for test conversations and sample messages.
- `src/middleware/` —
  - `auth.middleware.ts`: Verifies `x-user-id`, constant-time timing-safe comparisons for `x-internal-secret`, role guards.
  - `idempotency.middleware.ts`: Redis distributed lease lock preventing duplicate message and conversation mutations.
- `src/websocket/` —
  - `chat.gateway.ts`: Socket.IO 4 server mounted onto Fastify HTTP instance, configured with `@socket.io/redis-adapter` for multi-pod horizontal scaling. Room partitioning on `conv:{id}` and user channels `user:{userId}`. Employs hybrid room scoping: presence broadcasts are restricted exclusively to active conversation rooms (`conv:${id}`) to eliminate $O(N^2)$ global socket fanout.
  - `presence.service.ts`: Redis presence tracking (`ONLINE`, `OFFLINE`, `AWAY`) and heartbeat tracking.
- `src/services/` —
  - `conversation.service.ts`: Conversation creation, participant authorization, paginated thread listing, thread lookup, and `getUserConversationIds` for scoped presence distribution.
  - `message.service.ts`: Message dispatch, attachment linking, read receipts, abuse reporting, and blocking.
- `src/routes/` —
  - `conversation.routes.ts`: `/api/v1/chat/conversations` endpoints and `GET /api/v1/chat/presence/:userId` on-demand cached presence lookup.
  - `message.routes.ts`: `/api/v1/chat/conversations/:id/messages`, `/api/v1/chat/messages/:id/report`, `/api/v1/chat/users/:id/block`.
  - `health.routes.ts`: `/health`, `/metrics` (Prometheus).
- `src/kafka/` —
  - `producer.ts`: `@repo/kafka` producer with `{ value: payload }` envelope.

## API Endpoints

- `POST /api/v1/chat/conversations` — Create a conversation (buyer-to-seller, support ticket, order inquiry).
- `GET /api/v1/chat/conversations` — List conversations for authenticated user (or admin).
- `GET /api/v1/chat/conversations/:id` — Get single conversation details with participants.
- `GET /api/v1/chat/conversations/:id/messages` — Paginated message transcript.
- `POST /api/v1/chat/conversations/:id/messages` — Send message into conversation.
- `POST /api/v1/chat/conversations/:id/messages/read` — Mark conversation as read.
- `POST /api/v1/chat/messages/:messageId/report` — Report abusive message.
- `POST /api/v1/chat/users/:userId/block` — Block user from direct messaging.
- `GET /api/v1/chat/presence/:userId` — On-demand presence status lookup (`ONLINE`, `OFFLINE`, `AWAY`) querying Redis directly.
- `GET /health` — Service readiness probe.
- `GET /metrics` — Prometheus metrics.

## Kafka Events

- **Produced:**
  - `chat.conversation.created`
  - `chat.message.created`
  - `chat.message.reported`
