import z from "zod";

/**
 * Standard HTTP headers injected or propagated by the API Gateway across microservices.
 */
export const GATEWAY_HEADERS = {
  REQUEST_ID: "x-request-id",
  INTERNAL_SECRET: "x-internal-secret",
  USER_ID: "x-user-id",
  USER_ROLE: "x-user-role",
  IS_SUPER_ADMIN: "x-user-is-super-admin",
  IS_SELLER: "x-user-is-seller",
  CAN_MANAGE_SELLERS: "x-user-can-manage-sellers",
  GUEST_TOKEN: "x-guest-token",
  FORWARDED_FOR: "x-forwarded-for",
  IDEMPOTENCY_KEY: "idempotency-key",
  FORCE_PRIMARY: "x-force-primary",
  READ_YOUR_WRITES: "x-read-your-writes",
  CLIENT_SESSION_ID: "x-session-id",
  /**
   * PostgreSQL WAL LSN high-water mark echoed by write services on successful
   * mutations. The API Gateway caches it per client session for LSN-aware
   * Read-Your-Writes replica lag detection. Must never be trusted from client input.
   */
  DB_LSN: "x-db-lsn",
} as const;

export type GatewayHeaderKey =
  (typeof GATEWAY_HEADERS)[keyof typeof GATEWAY_HEADERS];

/**
 * Known insecure development placeholder values for internal service secrets.
 * These placeholders must NEVER be accepted when NODE_ENV is "production".
 */
export const DEFAULT_INTERNAL_SECRET = "dev-shared-internal-secret-larekmart";
export const INSECURE_INTERNAL_SECRET_PLACEHOLDERS = [
  DEFAULT_INTERNAL_SECRET,
  "dev-internal-secret-change-in-production",
  "dev_gateway_secret_change_in_production",
  "internal_secret_key_abc",
  "change_me_production_internal_service_secret",
  "secret",
  "change-me",
] as const;

/**
 * Placeholder Clerk secret keys that must never authenticate production traffic.
 * A deployment that forgets to configure CLERK_SECRET_KEY must fail closed instead
 * of accepting a well-known value (which would also make hand-rolled HS256 JWT
 * verification forgeable).
 */
export const INSECURE_CLERK_SECRET_PLACEHOLDERS = [
  "sk_test_placeholder",
  "sk_test_placeholder_key",
  "sk_test_mock_clerk_secret_key",
  "sk_test_123456789012345678901234567890",
  "sk_test_fake_secret_key_for_testing_12345",
] as const;

export function isInsecureClerkSecretKey(secret?: string | null): boolean {
  if (!secret || secret.trim().length === 0) return true;
  const value = secret.trim();
  return (
    INSECURE_CLERK_SECRET_PLACEHOLDERS.includes(value as any) ||
    /placeholder|change[_-]?me|for_testing|mock_clerk|fake_secret/i.test(value)
  );
}

/**
 * Validates that an internal service secret satisfies production fail-closed security invariants:
 * 1. Must be defined and non-empty.
 * 2. Must not match any known development placeholder.
 * 3. Must be at least 16 characters in length.
 *
 * If NODE_ENV is "production" and any condition fails, this function throws a fatal Error.
 */
export function validateInternalServiceSecret(
  secret?: string | null,
  nodeEnv: string = process.env.NODE_ENV || "development",
  serviceName: string = "service",
): void {
  if (nodeEnv === "production") {
    if (
      !secret ||
      INSECURE_INTERNAL_SECRET_PLACEHOLDERS.includes(secret as any) ||
      /placeholder|change[_-]?me|replace[_-]?me|__required|example|dummy/i.test(
      secret,
    ) ||
      secret.trim().length < 16
    ) {
      throw new Error(
        `[${serviceName}] FATAL: In production, INTERNAL_SERVICE_SECRET must be configured with a cryptographically secure random secret (minimum 16 characters) and cannot use development default placeholders.`,
      );
    }
  }
}

/**
 * Validates the Clerk secret key in production. A known placeholder is treated
 * exactly like a missing key: startup fails instead of silently accepting
 * attacker-forgeable credentials.
 */
export function validateClerkSecretKey(
  secret?: string | null,
  nodeEnv: string = process.env.NODE_ENV || "development",
  serviceName: string = "service",
): void {
  if (nodeEnv !== "production") return;

  if (!secret || isInsecureClerkSecretKey(secret) || !secret.startsWith("sk_")) {
    throw new Error(
      `[${serviceName}] FATAL: In production, CLERK_SECRET_KEY must be configured with a real Clerk secret key. Placeholder, mock, or missing values are rejected.`,
    );
  }
}

/**
 * Default browser origins permitted by first-party services in local
 * development. Production deployments must set CORS_ORIGIN/ALLOWED_ORIGINS.
 */
export const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3003",
] as const;

/**
 * Resolves a comma-separated origin allowlist, falling back to local frontend
 * origins. Never returns "*" — credentialed CORS must use an explicit allowlist.
 */
export function resolveCorsOrigins(raw?: string | null): string[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");
  return parsed.length > 0 ? parsed : [...DEFAULT_CORS_ORIGINS];
}

/**
 * Validated downstream microservices registered in the API Gateway.
 */
export const DOWNSTREAM_SERVICES = [
  "auth-service",
  "user-service",
  "catalog-service",
  "product-service",
  "inventory-service",
  "cart-service",
  "order-service",
  "payment-service",
  "shipping-service",
  "analytic-service",
  "notification-service",
  "search-service",
  "recommendation-service",
  "media-service",
] as const;

export type DownstreamServiceName = (typeof DOWNSTREAM_SERVICES)[number];

/**
 * Unified API Gateway route definition structure.
 */
export interface GatewayRouteConfig {
  prefix: string;
  target: string;
  serviceName: DownstreamServiceName | string;
  timeoutMs: number;
  rewritePrefix?: string;
  websocket?: boolean;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireSeller?: boolean;
}

/**
 * Standard Gateway Health Check Response schema.
 */
export const GatewayHealthResponseSchema = z.object({
  status: z.enum(["ok", "ready", "unhealthy"]),
  service: z.literal("api-gateway"),
  timestamp: z.string(),
});

export type GatewayHealthResponse = z.infer<typeof GatewayHealthResponseSchema>;

/**
 * Standard Gateway Structured Error Response schema.
 */
export const GatewayErrorResponseSchema = z.object({
  message: z.string(),
  statusCode: z.number().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
});

export type GatewayErrorResponse = z.infer<typeof GatewayErrorResponseSchema>;

/**
 * Gateway Home Aggregation Response schema.
 */
export const GatewayHomeAggregationResponseSchema = z.object({
  featured: z.array(z.any()),
  categories: z.array(z.any()),
  recommendations: z.any(),
  timestamp: z.string(),
  requestId: z.string(),
});

export type GatewayHomeAggregationResponse = z.infer<
  typeof GatewayHomeAggregationResponseSchema
>;
