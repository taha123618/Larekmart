import { z } from "zod";
import { DOWNSTREAM_SERVICES } from "@repo/types";

export const RouteAuthTierSchema = z.enum([
  "public",
  "authenticated",
  "admin",
  "seller",
]);

export type RouteAuthTier = z.infer<typeof RouteAuthTierSchema>;

export const RateLimitPolicyGroupSchema = z.enum([
  "AUTH",
  "PUBLIC_READ",
  "SEARCH",
  "WRITE",
  "CHECKOUT",
  "PAYMENT",
  "ADMIN",
]);

export type RateLimitPolicyGroup = z.infer<typeof RateLimitPolicyGroupSchema>;

export const GatewayRouteSchema = z.object({
  prefix: z.string(),
  target: z.string().url(),
  serviceName: z.enum(DOWNSTREAM_SERVICES),
  timeoutMs: z.number().int().positive().default(5000),
  rewritePrefix: z.string().optional(),
  websocket: z.boolean().optional(),
  requireAuth: z.boolean().optional(),
  requireAdmin: z.boolean().optional(),
  requireSeller: z.boolean().optional(),
  policyGroup: RateLimitPolicyGroupSchema.optional(),
  idempotent: z.boolean().optional(),
});

export type GatewayRoute = z.infer<typeof GatewayRouteSchema>;
