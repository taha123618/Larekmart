---
name: clerk-user-admin
description: Use when modifying admin user management endpoints, Clerk Backend SDK calls, or user.created Kafka event publishing in apps/auth-service.
---

# Clerk User Administration Workflows

Guidance for developing in `apps/auth-service` (Express 5, port 8003).

## 1. Service Scope & Security

- This service is strictly **admin-only**.
- All `/users` endpoints are protected by `shouldBeAdmin` middleware via `@clerk/express`.
- Non-admins must receive `403 Forbidden`.

## 2. Clerk Backend Integration

- Communicates with Clerk via `clerkClient` initialized in `src/utils/clerk.ts`.
- Supported Operations:
  - `GET /users`: `clerkClient.users.getUserList()`
  - `GET /users/:id`: `clerkClient.users.getUser(id)`
  - `POST /users`: `clerkClient.users.createUser(...)`
  - `DELETE /users/:id`: `clerkClient.users.deleteUser(id)`

## 3. Event Publishing

- On successful user creation, publish `user.created` event:
  ```ts
  await producer.send("user.created", {
    value: {
      username: newUser.username || `${newUser.firstName} ${newUser.lastName}`,
      email: newUser.emailAddresses[0]?.emailAddress,
    },
  });
  ```

## 4. Verification

```bash
pnpm --filter auth-service check-types
```
