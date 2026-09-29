# AGENTS.md — user-service

## 1. What this is

**user-service** manages customer profiles, saved addresses, preferences, and account settings in the Larekmart platform.
It runs **Fastify 5** on port **8012** with **PostgreSQL** (\`@repo/user-db\`), **Redis** (\`@repo/redis\`), and **Kafka** (\`@repo/kafka\`).

## 2. Boundaries & Golden Rules

- **Do not duplicate authentication.** \`auth-service\` owns passwords, credentials, sessions, and Clerk interaction. \`user-service\` owns customer profiles, addresses, and preferences.
- **Identity resolution:** Derive \`userId\` from verified Clerk session (\`shouldBeUser\` / \`shouldBeAdmin\`). Never trust client-supplied user IDs for personal resources.
- **PostgreSQL is authoritative.** Redis acts strictly as a cache with short TTLs and immediate cache invalidation on writes.
- **Cross-service communication is via Kafka.** Consume \`user.registered\` / \`user.created\` and publish \`user.profile_updated\`, \`user.address_created\`, \`user.preferences_updated\`, etc.
- **Idempotency:** Track processed Kafka events in the \`processed_events\` table to ensure exactly-once effect.

## 3. Routes

- \`GET /api/v1/users/me\` — fetch authenticated user profile and metadata
- \`PATCH /api/v1/users/me\` — update phone or core details
- \`GET /api/v1/users/me/profile\` & \`PATCH /api/v1/users/me/profile\` — profile info
- \`GET /api/v1/users/me/addresses\` & \`POST /api/v1/users/me/addresses\` — saved addresses
- \`GET|PATCH|DELETE /api/v1/users/me/addresses/:address_id\` — individual address management
- \`GET|PATCH /api/v1/users/me/preferences\` — localization and marketing preferences
- \`GET|PATCH /api/v1/users/me/settings\` — security and notification settings
- \`DELETE /api/v1/users/me\` — user deletion request
- \`GET /api/v1/users/admin/users\` — admin user listing
- \`GET /api/v1/users/admin/users/:id\` — admin user lookup
- \`PATCH /api/v1/users/admin/users/:id/status\` — admin user status update
