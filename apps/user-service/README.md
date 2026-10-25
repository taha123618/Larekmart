# user-service

User profiles, addresses, preferences, and account domain microservice for Larekmart.

## Technology Stack

- **Runtime:** Node.js (ESM)
- **Framework:** Fastify 5
- **Database:** PostgreSQL via `@repo/user-db` (Prisma)
- **Cache:** Redis via `@repo/redis`
- **Messaging:** Apache Kafka via `@repo/kafka`
- **Validation:** Zod via `@repo/types`
- **Authentication:** Clerk via `@clerk/fastify`
- **Observability:** Metrics and Logging via `@repo/monitoring`

## Endpoints Overview

| Method   | Route                                    | Description                                   | Auth   |
| -------- | ---------------------------------------- | --------------------------------------------- | ------ |
| `GET`    | `/api/v1/users/me`                       | Current user account overview                 | User   |
| `PATCH`  | `/api/v1/users/me`                       | Update current user account                   | User   |
| `GET`    | `/api/v1/users/me/profile`               | Current user profile                          | User   |
| `PATCH`  | `/api/v1/users/me/profile`               | Update profile                                | User   |
| `GET`    | `/api/v1/users/me/addresses`             | List saved addresses                          | User   |
| `POST`   | `/api/v1/users/me/addresses`             | Create new address                            | User   |
| `GET`    | `/api/v1/users/me/addresses/:address_id` | Get specific address                          | User   |
| `PATCH`  | `/api/v1/users/me/addresses/:address_id` | Update address                                | User   |
| `DELETE` | `/api/v1/users/me/addresses/:address_id` | Delete address                                | User   |
| `GET`    | `/api/v1/users/me/preferences`           | Get user preferences                          | User   |
| `PATCH`  | `/api/v1/users/me/preferences`           | Update preferences                            | User   |
| `GET`    | `/api/v1/users/me/settings`              | Get user settings                             | User   |
| `PATCH`  | `/api/v1/users/me/settings`              | Update user settings                          | User   |
| `DELETE` | `/api/v1/users/me`                       | Request user account deletion                 | User   |
| `GET`    | `/api/v1/users/admin/users`              | List all users                                | Admin  |
| `GET`    | `/api/v1/users/admin/users/:id`          | View specific user                            | Admin  |
| `PATCH`  | `/api/v1/users/admin/users/:id/status`   | Update user status & seller flag (`isSeller`) | Admin  |
| `GET`    | `/health`                                | Health checks                                 | Public |
| `GET`    | `/metrics`                               | Prometheus metrics                            | Public |

## Seller & Vendor Management Integration

- **`isSeller` Flag Persistence:** `UserProfile` in `@repo/user-db` stores the persistent `isSeller: boolean` flag indicating marketplace seller privileges.
- **Admin Status Updates:** `PATCH /api/v1/users/admin/users/:id/status` allows administrators to explicitly grant or revoke `isSeller` status alongside account status (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`).
- **Event-Driven Promotion:** `user-service` consumes the following Kafka events to automatically synchronize and promote `isSeller: true`:
  - `vendor.verified` (`vendor-service`): When a vendor's KYB compliance is approved.
  - `seller.created` (`seller-service`): When a merchant registers a new marketplace storefront.
  - `seller.activated` (`seller-service`): When a seller storefront transitions to active operational status.
