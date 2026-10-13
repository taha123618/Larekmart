import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  reviews,
  reviewMedia,
  sellerResponses,
  reviewModerationActions,
} from "../db/schema.js";
import type { ReviewMediaItemInput } from "@repo/types";

export interface CreateReviewParams {
  productId: string;
  userId: string;
  authorName: string;
  orderId?: string | null;
  rating: number;
  title: string;
  content: string;
  isVerifiedPurchase: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
  media?: ReviewMediaItemInput[];
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  sort?: "newest" | "highest_rating" | "lowest_rating" | "most_helpful";
  rating?: number;
  verifiedOnly?: boolean;
  hasMedia?: boolean;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
}

export class ReviewRepository {
  async createReview(params: CreateReviewParams) {
    return await db.transaction(async (tx) => {
      const [review] = await tx
        .insert(reviews)
        .values({
          productId: params.productId,
          userId: params.userId,
          authorName: params.authorName,
          orderId: params.orderId || null,
          rating: params.rating,
          title: params.title,
          content: params.content,
          isVerifiedPurchase: params.isVerifiedPurchase,
          status: params.status,
          helpfulCount: 0,
          unhelpfulCount: 0,
        })
        .returning();

      if (!review) {
        throw new Error("Failed to insert review");
      }

      let mediaList: any[] = [];
      if (params.media && params.media.length > 0) {
        mediaList = await tx
          .insert(reviewMedia)
          .values(
            params.media.map((m, index) => ({
              reviewId: review.id,
              mediaId: m.mediaId,
              mediaUrl: m.mediaUrl,
              mediaType: m.mediaType,
              displayOrder: m.displayOrder ?? index,
            })),
          )
          .returning();
      }

      return {
        ...review,
        media: mediaList,
        sellerResponse: null,
      };
    });
  }

  async getReviewById(reviewId: string) {
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) return null;

    const media = await db
      .select()
      .from(reviewMedia)
      .where(eq(reviewMedia.reviewId, reviewId))
      .orderBy(asc(reviewMedia.displayOrder));

    const [sellerResponse] = await db
      .select()
      .from(sellerResponses)
      .where(eq(sellerResponses.reviewId, reviewId))
      .limit(1);

    return {
      ...review,
      media,
      sellerResponse: sellerResponse || null,
    };
  }

  async getReviewsByProduct(productId: string, filters: ReviewFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(reviews.productId, productId),
      eq(reviews.status, "APPROVED"),
    ];

    if (filters.rating) {
      conditions.push(eq(reviews.rating, filters.rating));
    }
    if (filters.verifiedOnly) {
      conditions.push(eq(reviews.isVerifiedPurchase, true));
    }

    let orderByClause;
    switch (filters.sort) {
      case "highest_rating":
        orderByClause = [desc(reviews.rating), desc(reviews.createdAt)];
        break;
      case "lowest_rating":
        orderByClause = [asc(reviews.rating), desc(reviews.createdAt)];
        break;
      case "most_helpful":
        orderByClause = [desc(reviews.helpfulCount), desc(reviews.createdAt)];
        break;
      case "newest":
      default:
        orderByClause = [desc(reviews.createdAt)];
        break;
    }

    const items = await db
      .select()
      .from(reviews)
      .where(and(...conditions))
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(...conditions));

    const total = countResult?.total ?? 0;

    // Attach media & seller responses
    const enrichedItems = await Promise.all(
      items.map(async (review) => {
        const media = await db
          .select()
          .from(reviewMedia)
          .where(eq(reviewMedia.reviewId, review.id))
          .orderBy(asc(reviewMedia.displayOrder));

        const [sellerResponse] = await db
          .select()
          .from(sellerResponses)
          .where(eq(sellerResponses.reviewId, review.id))
          .limit(1);

        return {
          ...review,
          media,
          sellerResponse: sellerResponse || null,
        };
      }),
    );

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserReviews(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(reviews)
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.userId, userId));

    const total = countResult?.total ?? 0;

    const enrichedItems = await Promise.all(
      items.map(async (review) => {
        const media = await db
          .select()
          .from(reviewMedia)
          .where(eq(reviewMedia.reviewId, review.id))
          .orderBy(asc(reviewMedia.displayOrder));

        const [sellerResponse] = await db
          .select()
          .from(sellerResponses)
          .where(eq(sellerResponses.reviewId, review.id))
          .limit(1);

        return {
          ...review,
          media,
          sellerResponse: sellerResponse || null,
        };
      }),
    );

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdminReviews(status?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const conditions = status ? [eq(reviews.status, status)] : [];

    const items = await db
      .select()
      .from(reviews)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(reviews)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult?.total ?? 0;

    const enrichedItems = await Promise.all(
      items.map(async (review) => {
        const media = await db
          .select()
          .from(reviewMedia)
          .where(eq(reviewMedia.reviewId, review.id));

        return {
          ...review,
          media,
        };
      }),
    );

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateReview(
    reviewId: string,
    userId: string,
    updates: {
      rating?: number;
      title?: string;
      content?: string;
      media?: ReviewMediaItemInput[];
    },
  ) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(reviews)
        .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
        .limit(1);

      if (!existing) {
        return null;
      }

      const setValues: Record<string, any> = { updatedAt: new Date() };
      if (updates.rating !== undefined) setValues.rating = updates.rating;
      if (updates.title !== undefined) setValues.title = updates.title;
      if (updates.content !== undefined) setValues.content = updates.content;

      const [updated] = await tx
        .update(reviews)
        .set(setValues)
        .where(eq(reviews.id, reviewId))
        .returning();

      if (!updated) {
        return null;
      }

      if (updates.media !== undefined) {
        // Replace media items
        await tx.delete(reviewMedia).where(eq(reviewMedia.reviewId, reviewId));
        if (updates.media.length > 0) {
          await tx.insert(reviewMedia).values(
            updates.media.map((m, index) => ({
              reviewId,
              mediaId: m.mediaId,
              mediaUrl: m.mediaUrl,
              mediaType: m.mediaType,
              displayOrder: m.displayOrder ?? index,
            })),
          );
        }
      }

      const media = await tx
        .select()
        .from(reviewMedia)
        .where(eq(reviewMedia.reviewId, reviewId))
        .orderBy(asc(reviewMedia.displayOrder));

      return {
        ...updated,
        media,
      };
    });
  }

  async deleteReview(reviewId: string, userId?: string) {
    const conditions = [eq(reviews.id, reviewId)];
    if (userId) {
      conditions.push(eq(reviews.userId, userId));
    }

    const [deleted] = await db
      .delete(reviews)
      .where(and(...conditions))
      .returning();

    return deleted || null;
  }

  async moderateReview(
    reviewId: string,
    moderatorId: string,
    action: "APPROVE" | "REJECT" | "FLAG" | "ANONYMIZE",
    reason: string,
  ) {
    return await db.transaction(async (tx) => {
      let status: "APPROVED" | "REJECTED" | "FLAGGED" = "APPROVED";
      if (action === "REJECT") status = "REJECTED";
      if (action === "FLAG") status = "FLAGGED";

      const setValues: Record<string, any> = {
        status,
        updatedAt: new Date(),
      };

      if (action === "ANONYMIZE") {
        setValues.authorName = "Anonymous Customer";
      }

      const [updated] = await tx
        .update(reviews)
        .set(setValues)
        .where(eq(reviews.id, reviewId))
        .returning();

      if (!updated) return null;

      await tx.insert(reviewModerationActions).values({
        reviewId,
        moderatorId,
        action,
        reason,
      });

      return updated;
    });
  }

  async addSellerResponse(reviewId: string, sellerId: string, content: string) {
    const [response] = await db
      .insert(sellerResponses)
      .values({
        reviewId,
        sellerId,
        content,
      })
      .onConflictDoUpdate({
        target: sellerResponses.reviewId,
        set: {
          content,
          updatedAt: new Date(),
        },
      })
      .returning();

    return response;
  }

  async anonymizeUserReviews(userId: string) {
    return await db
      .update(reviews)
      .set({
        authorName: "Deleted User",
        updatedAt: new Date(),
      })
      .where(eq(reviews.userId, userId))
      .returning();
  }

  async archiveProductReviews(productId: string) {
    return await db
      .update(reviews)
      .set({
        status: "REJECTED",
        updatedAt: new Date(),
      })
      .where(eq(reviews.productId, productId))
      .returning();
  }
}

export const reviewRepository = new ReviewRepository();
