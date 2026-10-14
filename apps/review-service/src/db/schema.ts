import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  boolean,
  timestamp,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ==============================================================================
// 1. Purchase Eligibility Ledger (Tracks order.delivered unlocks)
// ==============================================================================

export const purchaseEligibility = pgTable(
  "purchase_eligibility",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    productId: varchar("product_id", { length: 255 }).notNull(),
    orderId: varchar("order_id", { length: 255 }).notNull(),
    orderItemId: varchar("order_item_id", { length: 255 }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull(),
    hasReviewed: boolean("has_reviewed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("purchase_eligibility_user_product_idx").on(
      table.userId,
      table.productId,
    ),
    index("purchase_eligibility_product_idx").on(table.productId),
    index("purchase_eligibility_order_idx").on(table.orderId),
  ],
);

// ==============================================================================
// 2. Reviews Table (Main Review Records)
// ==============================================================================

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: varchar("product_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    authorName: varchar("author_name", { length: 255 }).notNull(),
    orderId: varchar("order_id", { length: 255 }),
    rating: smallint("rating").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    isVerifiedPurchase: boolean("is_verified_purchase").default(true).notNull(),
    status: varchar("status", { length: 50 }).default("APPROVED").notNull(), // PENDING, APPROVED, REJECTED, FLAGGED
    helpfulCount: integer("helpful_count").default(0).notNull(),
    unhelpfulCount: integer("unhelpful_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reviews_user_product_idx").on(table.userId, table.productId),
    index("reviews_product_idx").on(table.productId),
    index("reviews_user_idx").on(table.userId),
    index("reviews_status_idx").on(table.status),
    index("reviews_rating_idx").on(table.rating),
    index("reviews_created_at_idx").on(table.createdAt),
  ],
);

// ==============================================================================
// 3. Review Media (References to Media Service Assets)
// ==============================================================================

export const reviewMedia = pgTable(
  "review_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .references(() => reviews.id, { onDelete: "cascade" })
      .notNull(),
    mediaId: varchar("media_id", { length: 255 }).notNull(),
    mediaUrl: varchar("media_url", { length: 1024 }).notNull(),
    mediaType: varchar("media_type", { length: 50 }).notNull(),
    displayOrder: smallint("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("review_media_review_idx").on(table.reviewId)],
);

// ==============================================================================
// 4. Review Votes (Helpful / Unhelpful with Duplicate Protection)
// ==============================================================================

export const reviewVotes = pgTable(
  "review_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .references(() => reviews.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    voteType: varchar("vote_type", { length: 50 }).notNull(), // HELPFUL, UNHELPFUL
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("review_votes_review_user_idx").on(
      table.reviewId,
      table.userId,
    ),
    index("review_votes_review_idx").on(table.reviewId),
  ],
);

// ==============================================================================
// 5. Review Reports (Abuse & Spam Flags)
// ==============================================================================

export const reviewReports = pgTable(
  "review_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .references(() => reviews.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    reason: varchar("reason", { length: 50 }).notNull(), // SPAM, ABUSIVE, OFF_TOPIC, FAKE_REVIEW, OTHER
    details: text("details"),
    status: varchar("status", { length: 50 }).default("OPEN").notNull(), // OPEN, RESOLVED, DISMISSED
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("review_reports_review_idx").on(table.reviewId),
    index("review_reports_status_idx").on(table.status),
  ],
);

// ==============================================================================
// 6. Review Moderation Actions (Audit History)
// ==============================================================================

export const reviewModerationActions = pgTable(
  "review_moderation_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .references(() => reviews.id, { onDelete: "cascade" })
      .notNull(),
    moderatorId: varchar("moderator_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(), // APPROVE, REJECT, FLAG, ANONYMIZE
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("review_moderation_review_idx").on(table.reviewId)],
);

// ==============================================================================
// 7. Seller Responses (1:1 Merchant Feedback)
// ==============================================================================

export const sellerResponses = pgTable(
  "seller_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .references(() => reviews.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    sellerId: varchar("seller_id", { length: 255 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("seller_responses_review_idx").on(table.reviewId),
    index("seller_responses_seller_idx").on(table.sellerId),
  ],
);

// ==============================================================================
// 8. Product Rating Summaries (Materialized Aggregate Cache/Table)
// ==============================================================================

export const productRatingSummaries = pgTable("product_rating_summaries", {
  productId: varchar("product_id", { length: 255 }).primaryKey(),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 })
    .default("0.00")
    .notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
  fiveStarCount: integer("five_star_count").default(0).notNull(),
  fourStarCount: integer("four_star_count").default(0).notNull(),
  threeStarCount: integer("three_star_count").default(0).notNull(),
  twoStarCount: integer("two_star_count").default(0).notNull(),
  oneStarCount: integer("one_star_count").default(0).notNull(),
  verifiedCount: integer("verified_count").default(0).notNull(),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
