---
name: code-review
description: Use when reviewing a change, PR, or diff in Larekmart — a monorepo-specific checklist covering boundaries, contracts, auth, events, and verification.
---

# Code review

Review against the repo's actual standards. Report findings as: **blocking** (breaks a
boundary/contract/security rule), **should-fix**, or **nit**.

## Checklist

### Boundaries & dependencies

- [ ] No app imports another app's code.
- [ ] Packages don't depend on apps; direction is app → package.
- [ ] New shared code went to the right package rather than being duplicated.
- [ ] Internal deps use `workspace:*`; new libraries are justified (prefer what the
      workspace already uses).

### Contracts & events

- [ ] Cross-boundary types/schemas live in `@repo/types`.
- [ ] If a Kafka payload changed: producer, **every** consumer, `@repo/types`, and
      `docs/EVENT-DRIVEN-ARCHITECTURE.md` were all updated together.
- [ ] Publishing still uses `{ value: payload }` and handlers read `message.value`.
- [ ] Removing/renaming an export from a package was checked against all consumers.

### Auth & security

- [ ] Mutating routes are guarded (`shouldBeUser` / `shouldBeAdmin`); non-admins can't
      reach admin functionality.
- [ ] `userId` is derived from the session, never from the request body.
- [ ] Stripe webhooks still verify the signature; no secrets or `.env` files leaked.
- [ ] `NEXT_PUBLIC_*` used only for non-secret values.

### Frontend

- [ ] Server Components by default; `"use client"` only where needed.
- [ ] Service URLs come from `NEXT_PUBLIC_*_SERVICE_URL`, not hardcoded.
- [ ] Auth token fetched correctly (`auth().getToken()` on the server,
      `useAuth().getToken()` on the client).
- [ ] New remote images registered in `next.config.ts`.

### Backend

- [ ] ESM `.js` import extensions follow the file's existing style.
- [ ] Errors return `{ message }` with an appropriate status; async Kafka handlers
      catch errors so the consumer survives.
- [ ] DB access goes through the designated package or service ORM schema (e.g. `@repo/product-db`, `@repo/order-db`, `@repo/cart-db`, Drizzle).
- [ ] Env vars added to the workspace `.env.example`.

### Quality & verification

- [ ] TypeScript strictness preserved (no `any` dumps, no `@ts-ignore` without reason).
- [ ] No generated Prisma code edited; schema changed instead.
- [ ] Dead/commented-out blocks are removed rather than accumulated (this repo has some
      legacy commented code — don't add more).
- [ ] `pnpm check-types` run; `pnpm build` / `pnpm lint` where applicable.
- [ ] Docs and `AGENTS.md` updated when behavior, contracts, or workflows changed.

## Tone

Be specific: cite the file and the rule it violates. Distinguish a genuine defect from a
style preference, and don't block on nits.
