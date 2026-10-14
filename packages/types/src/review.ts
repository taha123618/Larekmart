import { z } from "zod";

// ==============================================================================
// Enums & Constants
// ==============================================================================

export const ReviewStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  FLAGGED: "FLAGGED",
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const VoteType = {
  HELPFUL: "HELPFUL",
  UNHELPFUL: "UNHELPFUL",
} as const;
export type VoteType = (typeof VoteType)[keyof typeof VoteType];

export const ReportReason = {
  SPAM: "SPAM",
  ABUSIVE: "ABUSIVE",
  OFF_TOPIC: "OFF_TOPIC",
  FAKE_REVIEW: "FAKE_REVIEW",
  OTHER: "OTHER",
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ReportStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const ModerationAction = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  FLAG: "FLAG",
  ANONYMIZE: "ANONYMIZE",
} as const;
export type ModerationAction =
  (typeof ModerationAction)[keyof typeof ModerationAction];

export const ReviewSortOption = {
  NEWEST: "newest",
  HIGHEST_RATING: "highest_rating",
  LOWEST_RATING: "lowest_rating",
  MOST_HELPFUL: "most_helpful",
} as const;
export type ReviewSortOption =
  (typeof ReviewSortOption)[keyof typeof ReviewSortOption];

// ==============================================================================
// Zod Schemas
// ==============================================================================

export const ReviewMediaItemSchema = z.object({
  mediaId: z.string().min(1, "mediaId is required"),
  mediaUrl: z.string().url("Valid media URL required"),
  mediaType: z.string().min(1, "mediaType required"),
  displayOrder: z.number().int().nonnegative().optional().default(0),
});
export type ReviewMediaItemInput = z.infer<typeof ReviewMediaItemSchema>;

export const CreateReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(255, "Title too long")
    .trim(),
  content: z
    .string()
    .min(5, "Content must be at least 5 characters")
    .max(5000, "Content exceeds 5000 characters")
    .trim(),
  media: z
    .array(ReviewMediaItemSchema)
    .max(10, "Cannot attach more than 10 media items")
    .optional()
    .default([]),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().min(2).max(255).trim().optional(),
  content: z.string().min(5).max(5000).trim().optional(),
  media: z.array(ReviewMediaItemSchema).max(10).optional(),
});
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

export const VoteReviewSchema = z.object({
  voteType: z.enum(["HELPFUL", "UNHELPFUL"]),
});
export type VoteReviewInput = z.infer<typeof VoteReviewSchema>;

export const ReportReviewSchema = z.object({
  reason: z.enum(["SPAM", "ABUSIVE", "OFF_TOPIC", "FAKE_REVIEW", "OTHER"]),
  details: z.string().max(1000).trim().optional(),
});
export type ReportReviewInput = z.infer<typeof ReportReviewSchema>;

export const CreateSellerResponseSchema = z.object({
  content: z
    .string()
    .min(5, "Response must be at least 5 characters")
    .max(3000, "Response cannot exceed 3000 characters")
    .trim(),
});
export type CreateSellerResponseInput = z.infer<
  typeof CreateSellerResponseSchema
>;

export const ModerateReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "FLAG", "ANONYMIZE"]),
  reason: z.string().min(3, "Reason required for audit trail").max(1000).trim(),
});
export type ModerateReviewInput = z.infer<typeof ModerateReviewSchema>;

export const ReviewQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sort: z
    .enum(["newest", "highest_rating", "lowest_rating", "most_helpful"])
    .optional()
    .default("newest"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verifiedOnly: z.coerce.boolean().optional().default(false),
  hasMedia: z.coerce.boolean().optional().default(false),
});
export type ReviewQueryInput = z.infer<typeof ReviewQuerySchema>;

// ==============================================================================
// Domain Entity Interfaces
// ==============================================================================

export interface ReviewMedia {
  id: string;
  reviewId: string;
  mediaId: string;
  mediaUrl: string;
  mediaType: string;
  displayOrder: number;
  createdAt: Date;
}

export interface SellerResponse {
  id: string;
  reviewId: string;
  sellerId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  orderId: string | null;
  rating: number;
  title: string;
  content: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  helpfulCount: number;
  unhelpfulCount: number;
  media?: ReviewMedia[];
  sellerResponse?: SellerResponse | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewVote {
  id: string;
  reviewId: string;
  userId: string;
  voteType: VoteType;
  createdAt: Date;
}

export interface ReviewReport {
  id: string;
  reviewId: string;
  userId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: Date;
}

export interface ReviewModerationAction {
  id: string;
  reviewId: string;
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  createdAt: Date;
}

export interface PurchaseEligibility {
  id: string;
  userId: string;
  productId: string;
  orderId: string;
  orderItemId: string;
  deliveredAt: Date;
  hasReviewed: boolean;
  createdAt: Date;
}

export interface ProductRatingSummary {
  productId: string;
  averageRating: number;
  reviewCount: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  verifiedCount: number;
  lastCalculatedAt: Date;
}

// ==============================================================================
// Kafka Event Contracts
// ==============================================================================

export interface ReviewCreatedEvent {
  reviewId: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: string;
}

export interface ReviewUpdatedEvent {
  reviewId: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  updatedAt: string;
}

export interface ReviewDeletedEvent {
  reviewId: string;
  productId: string;
  userId: string;
  deletedAt: string;
}

export interface ReviewApprovedEvent {
  reviewId: string;
  productId: string;
  moderatorId: string;
  approvedAt: string;
}

export interface ReviewRejectedEvent {
  reviewId: string;
  productId: string;
  moderatorId: string;
  reason: string;
  rejectedAt: string;
}

export interface ReviewReportedEvent {
  reportId: string;
  reviewId: string;
  productId: string;
  userId: string;
  reason: ReportReason;
  totalReportCount: number;
  status: ReviewStatus;
  reportedAt: string;
}

export interface ProductRatingSummaryUpdatedEvent {
  productId: string;
  averageRating: number;
  reviewCount: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  verifiedCount: number;
  updatedAt: string;
}
