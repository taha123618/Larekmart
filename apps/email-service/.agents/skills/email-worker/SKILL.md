---
name: email-worker
description: Use when modifying Kafka event consumption, email templates, or Nodemailer OAuth2 transport configuration in apps/email-service.
---

# Email Worker Workflows

Guidance for developing in `apps/email-service` (Node.js headless worker).

## 1. Worker Architecture

- `email-service` has no HTTP listener or web framework. It operates purely as an asynchronous Kafka consumer worker.

## 2. Kafka Topic Subscriptions

- Subscribes to:
  - `user.created`: Extracts `{ username, email }` from `message.value` and dispatches a welcome email.
  - `order.created`: Extracts `{ email, amount, status }` from `message.value` and dispatches an order confirmation receipt.

## 3. Nodemailer OAuth2 Transport

- Configured with Gmail OAuth2 in `src/utils/mailer.ts`:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
- Handlers catch delivery errors to prevent uncaught promise rejections from killing the consumer loop.

## 4. Verification

```bash
pnpm --filter email-service check-types
```
