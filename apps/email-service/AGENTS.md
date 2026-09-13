# AGENTS.md — apps/email-service (email worker)

Scope: `apps/email-service` only. Root rules still apply — start there.

## What this service is

A headless Kafka consumer worker with no HTTP surface. It consumes `user.created` and
`order.created` and sends email via nodemailer (Gmail OAuth2).

## Where things live

- `src/index.ts` — worker bootstrap, Kafka consumer setup, and topic handlers.
- Topic handlers are registered as `[{ topicName, topicHandler }]` subscriptions.

## Framework and style

- No web framework; this is a worker.
- ESM (`"type": "module"`).
- Local imports use explicit `.js` extensions where the file already does; match the file
  you are editing.

## Kafka integration

- Use `@repo/kafka` for consumer setup; do not instantiate `kafkajs` directly here.
- One consumer group for this service.
- Subscriptions use `fromBeginning: true`; handlers must be tolerant of re-processing.
- Use the `{ value: payload }` envelope and read `message.value` in handlers.
- Current topics consumed: `user.created`, `order.created`.
- If you change a payload, update the producer, every consumer, `@repo/types`, and
  `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Email sending

- Use nodemailer with Gmail OAuth2. Credentials come from env
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`).
- Do not hardcode email addresses, tokens, or OAuth secrets.
- Keep email templates simple and readable; do not build heavy rendering pipelines here
  unless the product actually needs them.

## Error handling

- Kafka handlers must catch and log so a bad message does not kill the consumer loop.
- There is no dead-letter topic or retry policy yet; treat handler failures as observable.
- Do not throw uncaught errors out of a handler.

## What not to do

- Do not add an HTTP server or health endpoint unless the product needs one.
- Do not import frontend or service internals.
- Do not access Postgres or MongoDB here.
- Do not hardcode secrets; read from env and add new keys to `.env.example`.

## Verification

- `pnpm --filter email-service check-types`
- Manual run against local Kafka.
- No general JavaScript test runner exists yet; verify this worker with its type-check and manual Kafka flows.
