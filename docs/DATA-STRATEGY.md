# Data Strategy Document — Larekmart E-Commerce Platform

## 1. Data Architecture Principles

1. **Database-per-Service Paradigm**: Each microservice strictly owns its operational database. Direct cross-database queries or shared connections between services are strictly prohibited.
2. **Polyglot Persistence**: The data store is selected based on the domain's operational and query characteristics:
   - **PostgreSQL (Relational)**: Structured catalog, relational constraints, foreign keys, and analytical audit logs.
   - **MongoDB (Document)**: Highly nested, schema-flexible order histories, customer addresses, and line-item snapshots.
   - **Kafka (Streaming)**: Distributed immutable event commit log for asynchronous cross-service choreography.
3. **Eventual Consistency**: State synchronization across services is achieved through Kafka event streams with idempotent consumer handlers.

---

## 2. Bounded Contexts & Data Ownership

| Bounded Context        | Owning Microservice     | Storage Engine   | Access Layer                | Data Lifecycle                                |
| :--------------------- | :---------------------- | :--------------- | :-------------------------- | :-------------------------------------------- |
| **Catalog & Products** | `apps/product-service`  | PostgreSQL       | `@repo/product-db` (Prisma) | CRUD with transactional ACID guarantees       |
| **Orders & Sales**     | `apps/order-service`    | MongoDB          | `@repo/order-db` (Mongoose) | Append-mostly with high write throughput      |
| **Checkout & Billing** | `apps/payment-service`  | Stripe Vault     | `stripe` Node SDK           | Tokenized sessions with PCI-DSS compliance    |
| **User Identity**      | `apps/auth-service`     | Clerk Identity   | `@clerk/express` SDK        | Managed user store with JWT session claims    |
| **Transactional Mail** | `apps/email-service`    | Ephemeral        | Nodemailer / OAuth2         | In-memory message consumption                 |
| **Platform Analytics** | `apps/analytic-service` | PostgreSQL / Mem | `pg.Pool`                   | Immutable event log + daily rollup aggregates |

---

## 3. Event Streaming & Consistency Guarantees

```
[Producer Service] ───(JSON { value: payload })───▶ [Kafka Broker]
                                                           │
                      ┌────────────────────────────────────┴────────────────────────────────────┐
                      ▼                                                                         ▼
           [Consumer Service 1]                                                      [Consumer Service 2]
         (Handler: message.value)                                                  (Handler: message.value)
```

- **Serialization**: JSON-encoded payload enveloped under `{ value: <data> }`.
- **Partitioning & Ordering**: Topic-level ordering guaranteed per key.
- **Consumer Offsets**: Managed via Kafka Consumer Groups (`fromBeginning: true` for state recovery).
- **At-Least-Once Delivery**: Handlers must be idempotent to tolerate duplicate event consumption or historical replays.

---

## 4. Data Security, Privacy & Compliance

- **PII Protection**: Sensitive customer credentials, passwords, and payment card numbers are never stored in internal databases.
- **Encryption in Transit**: All external API traffic requires TLS 1.3; database connections use SSL in production.
- **Encryption at Rest**: PostgreSQL tables and MongoDB collections use AES-256 transparent data encryption (TDE).
- **Sanitization in Logs**: No raw auth tokens, secret keys, or credit card numbers are logged to stdout/stderr.
