# Email Service (`apps/email-service`)

Headless background worker consuming Kafka events to deliver transactional emails.

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Transport**: Nodemailer with Google OAuth2 Gmail transport

## Event Integrations

- **Consumes**:
  - `user.created`: Sends welcome email to newly created users.
  - `order.created`: Sends order confirmation receipt to customers.

## Environment Variables

Copy `.env.example` to `.env`:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
```

## Development Commands

```bash
# Run standalone
pnpm --filter email-service dev

# Type check
pnpm --filter email-service check-types
```
