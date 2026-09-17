import { z } from "zod";

export const RecommendationItemSchema = z.object({
  productId: z.number().int().positive(),
  score: z.number().min(0).max(1),
  reason: z.string(),
  strategy: z.string().optional(),
  categorySlug: z.string().nullable().optional(),
});

export type RecommendationItemType = z.infer<typeof RecommendationItemSchema>;

export const RecommendationMetadataSchema = z.object({
  strategy: z.string(),
  modelVersion: z.string(),
  executionTimeMs: z.number(),
  cached: z.boolean(),
  generatedAt: z.string(),
  fallbackUsed: z.boolean(),
});

export type RecommendationMetadataType = z.infer<
  typeof RecommendationMetadataSchema
>;

export const RecommendationResponseSchema = z.object({
  userId: z.string().nullable().optional(),
  type: z.string(),
  items: z.array(RecommendationItemSchema),
  metadata: RecommendationMetadataSchema,
});

export type RecommendationResponseType = z.infer<
  typeof RecommendationResponseSchema
>;

export const HomeRecommendationsResponseSchema = z.object({
  userId: z.string().nullable().optional(),
  trending: RecommendationResponseSchema,
  popular: RecommendationResponseSchema,
  personalized: RecommendationResponseSchema.nullable().optional(),
  recentlyViewed: RecommendationResponseSchema.nullable().optional(),
});

export type HomeRecommendationsResponseType = z.infer<
  typeof HomeRecommendationsResponseSchema
>;

export const StrategyMetricSchema = z.object({
  strategy: z.string(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  ctr: z.number(),
  conversions: z.number().int().nonnegative(),
  conversion_rate: z.number(),
});

export type StrategyMetricType = z.infer<typeof StrategyMetricSchema>;

export const InteractionCreateSchema = z.object({
  userId: z.string().min(1),
  productId: z.number().int().positive(),
  eventType: z.enum([
    "VIEW",
    "SEARCH",
    "WISHLIST",
    "ADD_TO_CART",
    "REMOVE_FROM_CART",
    "ORDER_COMPLETED",
    "REVIEW_CREATED",
  ]),
  eventId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  occurredAt: z.string().nullable().optional(),
});

export type InteractionCreateType = z.infer<typeof InteractionCreateSchema>;
