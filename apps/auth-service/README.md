# Auth Service (`apps/auth-service`)

Microservice providing admin-only user management proxying the Clerk Backend API.

## Tech Stack

- **Framework**: Express 5
- **Auth**: Clerk Backend SDK (`@clerk/express`)
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Port**: `8003`

## Endpoints

- `GET /users`: List users from Clerk (admin only).
- `GET /users/:id`: Retrieve single user by ID (admin only).
- `POST /users`: Create new Clerk user and emit `user.created` (admin only).
- `DELETE /users/:id`: Delete Clerk user (admin only).
- `GET /health`: Health check (`status`, `uptime`, `timestamp`).

## Event Integrations

- **Emits**: `user.created` (consumed by `email-service` for welcome emails).

## Environment Variables

Copy `.env.example` to `.env`:

```env
CLERK_SECRET_KEY=sk_test_...
```

## Development Commands

```bash
# Run standalone
pnpm --filter auth-service dev

# Type check
pnpm --filter auth-service check-types
```
