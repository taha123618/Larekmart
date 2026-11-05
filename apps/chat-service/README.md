# Larekmart Chat Service

Real-time communications microservice powering buyer-to-seller messaging and live customer support in Larekmart.

## Tech Stack

- **Runtime**: Node.js 20+, Fastify 5, TypeScript
- **Real-Time Gateway**: Socket.IO 4 + `@socket.io/redis-adapter`
- **Database**: PostgreSQL (`larekmart_chat_db`) via Drizzle ORM
- **Cache & Presence**: Redis (ioredis)
- **Messaging Pipeline**: Kafka (`@repo/kafka`)
- **Validation**: Zod + `@repo/types`
- **Port**: 8026

## Features

- **Direct Buyer-to-Seller Messaging**: Inquiries, order-linked discussions, product-context cards.
- **Live Customer Support**: Real-time communication channels bound to customer support tickets.
- **Horizontal Scalability**: Cross-instance event distribution via Redis Pub/Sub adapter.
- **Presence & Typing**: Active heartbeat presence tracking and ephemeral typing indicators.
- **Delivery & Read Receipts**: Real-time delivery acknowledgments and read receipts.
- **Moderation & Safety**: Abuse reporting, user blocking, and staff oversight.
- **Idempotency**: Distributed `Idempotency-Key` lease locking preventing duplicate messages.

## Running Locally

```bash
# 1. Run database migration
pnpm --filter chat-service db:migrate

# 2. Seed test data
pnpm --filter chat-service db:seed

# 3. Start development server
pnpm --filter chat-service dev
```

## Running Tests

```bash
pnpm --filter chat-service test
```
