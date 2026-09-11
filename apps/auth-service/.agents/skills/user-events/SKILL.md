---
name: user-events
description: Use when modifying user lifecycle event emission (user.created) or Clerk user webhook triggers in apps/auth-service.
---

# User Event Emission & Handling

Guidance for publishing user events from `apps/auth-service`.

## 1. Event Contract: `user.created`

- **Trigger**: Emitted after a new user is successfully registered via `POST /users` through Clerk Backend SDK.
- **Payload Envelope**:
  ```ts
  {
    value: {
      username: newUser.username || `${newUser.firstName} ${newUser.lastName}`,
      email: newUser.emailAddresses[0]?.emailAddress
    }
  }
  ```
- **Consumer**: `email-service` (sends a welcome email to the new account).

## 2. Error Isolation

- Catch Kafka publisher errors and log them without rolling back or failing the Clerk user creation response.
