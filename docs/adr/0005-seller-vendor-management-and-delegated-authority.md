# 5. Seller and Vendor Management, Platform Controls, and Delegated Authority

Date: 2026-10-25
Status: Accepted

## Context

Larekmart operates as a multi-vendor marketplace platform alongside first-party retail. To support merchant scaling while enforcing legal compliance, customer trust, and operational integrity, the platform required:

1. **Separation of Legal Entities and Customer-Facing Stores**: Legal business entities (with business registration numbers, tax IDs, banking information, and KYB identity documents) must be distinguished from consumer-facing merchant storefronts (store names, slugs, logos, banners, refund policies).
2. **Platform-Level Feature Kill Switch (`isSellerEnabled`)**: Super Administrators must be able to globally pause or resume all marketplace seller capabilities (storefronts, vendor registrations, seller portals) without requiring code deployments or service restarts.
3. **Delegated Administration**: While Super Administrators retain supreme control over platform toggles and administrative delegations, designated Manage Admins must be able to approve, suspend, and oversee vendors and sellers when delegated the `manage_sellers` authority.
4. **Consistent Identity & Capability Propagation**: Downstream services (such as `order-service`, `user-service`, and `analytic-service`) and frontends (`apps/client`, `apps/admin`) need reliable access to seller capabilities and status without making point-to-point HTTP service calls.

## Decision

We designed and implemented a dedicated, decoupled architecture across `@repo/vendor-db`, `vendor-service`, `seller-service`, `api-gateway`, `user-service`, `apps/admin`, and `apps/client`:

1. **Service Boundary & Polyglot Storage**:
   - **`vendor-service` (`:8020`, NestJS + Fastify)**: Owns legal business entities, business profiles, KYB documents, verifications, and compliance states via Prisma (`@repo/vendor-db`) targeting PostgreSQL (`larekmart_vendor_db`).
   - **`seller-service` (`:8021`, Fastify 5)**: Owns marketplace storefront configuration, staff rosters, operating settings, performance metrics, system governance settings (`system_settings`), and administrative delegations (`admin_delegations`) via Drizzle ORM targeting PostgreSQL (`larekmart_seller_db`).
2. **Administrative Delegation Model (`admin_delegations`)**:
   - Super Administrators (role `super_admin` or `isSuperAdmin: true` in Clerk claims) can grant and revoke granular delegation scopes (`manage_sellers`) to administrative users.
   - The `/api/v1/admin/delegations` API is owned by `seller-service` and proxied securely by `api-gateway`.
   - `api-gateway` enforces delegation checks and propagates `x-user-can-manage-sellers: true` downstream to authorize Manage Admins.
3. **Platform-Level Kill Switch (`isSellerEnabled`)**:
   - Stored in `seller-service`'s `system_settings` table and cached in Redis under `marketplace:system_settings`.
   - Publicly readable via `GET /api/v1/system-settings` with 30-second client-side stale-time.
   - Modifiable only by Super Admins via `PATCH /api/v1/admin/system-settings`.
   - Frontends dynamically hide/disable merchant registration, storefront links, and seller portal tabs when `isSellerEnabled` is false.
4. **Seller Privilege Propagation & Event-Driven Promotion**:
   - `user-service` persists an `isSeller` boolean on `UserProfile` in `user_db` (`@repo/user-db`).
   - `user-service` consumes Kafka events `vendor.verified`, `seller.created`, and `seller.activated` to automatically set `isSeller: true` on the merchant's profile.
   - `api-gateway` reads Clerk session metadata and downstream context, injecting `x-user-is-seller: true` into authenticated requests.
   - Downstream services (e.g. `order-service`'s `shouldBeSeller` guard) check the reverse proxy header `x-user-is-seller` or Clerk session claims.
5. **Frontends (`apps/admin` & `apps/client`)**:
   - **`apps/admin`**: Dedicated `/vendors` KYB review workflow, `/sellers` storefront oversight, `/settings` Super Admin governance & delegation management, `/users` role filtering with `isSeller` inline toggling, and dashboard KPI cards showcasing Active Sellers and Verified Vendors.
   - **`apps/client`**: Dynamic navigation (Seller Portal vs Sell on Larekmart), `/become-a-seller` multi-step onboarding flow, `/stores/[slug]` merchant storefront pages, `SellerBadge` trust tags on products, and merchant attribution on product cards and cart items.

## Consequences

### Positive

- Strict separation between legal entity KYB (`vendor-service`) and operational customer storefronts (`seller-service`).
- Zero direct service-to-service HTTP dependencies; all privilege promotions and status syncs occur asynchronously over Kafka (`@repo/kafka`).
- Platform governance is decoupled from code deployments: Super Admins can pause seller operations instantly via `isSellerEnabled`.
- Manage Admins operate with delegated authority without granting global Super Admin access.
- Seamless reverse-proxy header injection (`x-user-is-seller`, `x-user-can-manage-sellers`) minimizes repetitive database queries across downstream microservices.

### Trade-offs

- Delegation cache in `api-gateway` or services requires cache invalidation or brief TTL expiry (bounded to 60s) when delegations are revoked.
- Dual-role users (buying customers who become sellers) have state updated asynchronously via Kafka; short eventual consistency window before `isSeller` reflects across all read models.
