# Vendor Service Design Specification

- **Date**: 2026-10-22
- **Service Name**: `vendor-service`
- **Port**: `8020`
- **Database**: `vendor_db` (PostgreSQL via `@repo/vendor-db` Prisma client)
- **Framework**: Node.js + TypeScript + NestJS (Fastify Platform Adapter)
- **Integration**: Kafka, Redis, Zod, Clerk auth headers, OpenTelemetry, Docker

---

## 1. Overview & Business Domain

`vendor-service` provides enterprise-grade merchant onboarding, legal organization management, KYB (Know Your Business) verification workflows, authorized representative management, and lifecycle state management (active, suspended, rejected, terminated).

### Separation of Concerns:
- **`vendor-service`**: Owns the legal/business entity, registration credentials, business profiles, KYB documents, compliance verification, and representative access controls.
- **`seller-service`**: Owns marketplace selling operations, storefront configuration, shipping settings, and seller product listings. A verified vendor may operate one or more seller accounts.

---

## 2. Shared Persistence Package: `@repo/vendor-db`

The schema and Prisma client live in `packages/vendor-db`, following the established monorepo convention (`@repo/user-db`, `@repo/product-db`, `@repo/inventory-db`).

### Schema Models (`schema.prisma`):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

enum OrganizationType {
  CORPORATION
  LLC
  PARTNERSHIP
  SOLE_PROPRIETORSHIP
}

enum VendorStatus {
  DRAFT
  PENDING_VERIFICATION
  VERIFIED
  REJECTED
  SUSPENDED
  TERMINATED
}

enum DocumentType {
  BUSINESS_REGISTRATION
  TAX_CERTIFICATE
  PROOF_OF_ADDRESS
  ARTICLES_OF_INCORPORATION
  DIRECTOR_ID
  BANK_STATEMENT
}

enum DocumentVerificationStatus {
  PENDING
  ACCEPTED
  REJECTED
}

enum VerificationWorkflowType {
  MANUAL_ADMIN
  AUTOMATED_KYB
  EXTERNAL_PROVIDER
}

enum VerificationStatus {
  INITIATED
  IN_REVIEW
  APPROVED
  REJECTED
  EXPIRED
}

enum MemberRole {
  OWNER
  ADMIN
  COMPLIANCE_OFFICER
  MEMBER
}

enum MemberStatus {
  INVITED
  ACTIVE
  REVOKED
}

model Vendor {
  id                 String                  @id @default(uuid())
  legalName          String
  tradeName          String?
  organizationType   OrganizationType
  registrationNumber String                  @unique
  taxIdentifier      String
  country            String                  // ISO 3166-1 alpha-2
  status             VendorStatus            @default(DRAFT)
  ownerUserId        String                  // Clerk User ID
  createdAt          DateTime                @default(now())
  updatedAt          DateTime                @updatedAt

  businessProfile    VendorBusinessProfile?
  documents          VendorDocument[]
  verifications      VendorVerification[]
  members            VendorMember[]
  statusHistory      VendorStatusHistory[]

  @@map("vendors")
}

model VendorBusinessProfile {
  id                            String   @id @default(uuid())
  vendorId                      String   @unique
  industryCategory              String
  websiteUrl                    String?
  businessEmail                 String
  businessPhone                 String
  registeredAddressLine1        String
  registeredAddressLine2        String?
  city                          String
  state                         String
  postalCode                    String
  country                       String   // ISO 3166-1 alpha-2
  authorizedRepresentativeName  String
  authorizedRepresentativeEmail String
  authorizedRepresentativePhone String
  authorizedRepresentativeRole  String
  createdAt                     DateTime @default(now())
  updatedAt                     DateTime @updatedAt

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("vendor_business_profiles")
}

model VendorDocument {
  id                 String                     @id @default(uuid())
  vendorId           String
  documentType       DocumentType
  mediaFileId        String                     // UUID from media-service
  fileName           String
  fileSize           Int
  mimeType           String
  uploadedByUserId   String
  verificationStatus DocumentVerificationStatus @default(PENDING)
  rejectionReason    String?
  createdAt          DateTime                   @default(now())
  updatedAt          DateTime                   @updatedAt

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("vendor_documents")
}

model VendorVerification {
  id                 String                   @id @default(uuid())
  vendorId           String
  workflowType       VerificationWorkflowType @default(MANUAL_ADMIN)
  status             VerificationStatus       @default(INITIATED)
  reviewedByAdminId  String?
  reviewNotes        String?
  verificationScores Json?                    // Automated scoring breakdown
  submittedAt        DateTime                 @default(now())
  decidedAt          DateTime?

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("vendor_verifications")
}

model VendorMember {
  id          String       @id @default(uuid())
  vendorId    String
  userId      String       // Clerk User ID
  role        MemberRole   @default(MEMBER)
  permissions String[]     @default([])
  status      MemberStatus @default(ACTIVE)
  joinedAt    DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@unique([vendorId, userId])
  @@map("vendor_members")
}

model VendorStatusHistory {
  id              String       @id @default(uuid())
  vendorId        String
  fromStatus      VendorStatus
  toStatus        VendorStatus
  changedByUserId String       // Clerk User ID or Admin ID
  changeReason    String
  notes           String?
  createdAt       DateTime     @default(now())

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@map("vendor_status_history")
}
```

---

## 3. NestJS Architecture (`apps/vendor-service`)

### Directory Structure:
```
apps/vendor-service/
├── src/
│   ├── common/
│   │   ├── decorators/        # AuthUser, Roles, CurrentVendor
│   │   ├── filters/           # GlobalExceptionFilter (RFC 7807 / standard { message })
│   │   ├── guards/            # AuthGuard, RolesGuard, VendorMemberGuard
│   │   ├── interceptors/      # LoggingInterceptor, TransformInterceptor
│   │   └── pipes/             # ZodValidationPipe
│   ├── config/
│   │   └── env.ts             # Zod-parsed environment schema
│   ├── database/
│   │   ├── database.module.ts # NestJS Module providing PrismaService
│   │   └── prisma.service.ts  # Life-cycle managed @repo/vendor-db PrismaClient
│   ├── kafka/
│   │   ├── kafka.module.ts
│   │   ├── kafka.producer.ts  # Typed producer for vendor events
│   │   └── kafka.consumer.ts  # Consumer for lifecycle triggers
│   ├── redis/
│   │   ├── redis.module.ts
│   │   └── redis.service.ts   # Caching layer for vendor status & membership
│   ├── modules/
│   │   ├── vendors/           # Vendor entity management & registration
│   │   ├── documents/         # Business verification document references
│   │   ├── kyb/               # Automated KYB validation rules & engine
│   │   └── admin/             # Backoffice review, approval, suspension
│   ├── health/
│   │   ├── health.module.ts
│   │   └── health.controller.ts # /health, /ready, /metrics
│   ├── app.module.ts
│   └── main.ts                # FastifyAdapter bootstrap
├── tests/
│   └── vendor-service.test.ts # Standalone integration suite using Fastify inject
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. REST Endpoints & Contracts

### Public / Merchant Endpoints:
- `POST /api/v1/vendors`
  - Body: Legal name, organization type, registration number, tax ID, country, business profile, authorized representative.
  - Creates Vendor in `DRAFT` status and assigns creator as `OWNER`.
- `GET /api/v1/vendors/:vendorId`
  - Returns vendor details, business profile, and verification state.
- `PATCH /api/v1/vendors/:vendorId`
  - Updates profile information. Allowed in `DRAFT` or with admin approval.
- `POST /api/v1/vendors/:vendorId/documents`
  - Attaches uploaded media ID with DocumentType.
- `POST /api/v1/vendors/:vendorId/submit-verification`
  - Verifies minimum required documents exist, changes status to `PENDING_VERIFICATION`, publishes `vendor.verification.requested`.
- `GET /api/v1/vendors/:vendorId/documents`
  - Lists attached documents and verification remarks.
- `GET /api/v1/vendors/user/me`
  - Returns list of organizations associated with current Clerk user.

### Admin Backoffice Endpoints:
- `GET /api/v1/admin/vendors`
  - Query parameters: `status`, `country`, `search`, `page`, `limit`.
- `GET /api/v1/admin/vendors/:vendorId`
  - Complete compliance view including all documents, audit trail, and member lists.
- `POST /api/v1/admin/vendors/:vendorId/approve`
  - Sets status to `VERIFIED`, publishes `vendor.verified`.
- `POST /api/v1/admin/vendors/:vendorId/reject`
  - Body: `reason`, `notes`. Sets status to `REJECTED`, publishes `vendor.rejected`.
- `POST /api/v1/admin/vendors/:vendorId/suspend`
  - Body: `reason`. Sets status to `SUSPENDED`, publishes `vendor.suspended`.
- `POST /api/v1/admin/vendors/:vendorId/reactivate`
  - Sets status to `VERIFIED`, publishes `vendor.reactivated`.

---

## 5. Event-Driven Architecture (`@repo/kafka`)

### Topics:
- `vendor.registered`
- `vendor.verification.requested`
- `vendor.verified`
- `vendor.rejected`
- `vendor.suspended`
- `vendor.reactivated`

All payloads implement the `{ value: T }` envelope pattern and are typed in `@repo/types`.

---

## 6. Monorepo Integration Checklist
1. **`packages/types`**: Export vendor schemas, DTOs, and event payloads.
2. **`packages/vendor-db`**: Prisma schema, migration scripts, and generated Prisma client.
3. **`packages/kafka`**: Topic definitions in `init-topics.ts`.
4. **`apps/api-gateway`**: Fastify reverse proxy mapping `/api/v1/vendors` and `/api/v1/admin/vendors` to port 8020.
5. **Infrastructure**: Port 8020 mapping, `vendor_db` in `docker-compose.yml` and Kubernetes manifests.
6. **Testing**: Fastify inject integration tests validating status transitions and role checks.
