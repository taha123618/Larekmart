import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { productRatingSummaries, reviews } from "../db/schema.js";

export class SummaryRepository {
  async getSummary(productId: string) {
    const [summary] = await db
      .select()
      .from(productRatingSummaries)
      .where(eq(productRatingSummaries.productId, productId))
      .limit(1);

    if (!summary) {
      return {
        productId,
        averageRating: 0,
        reviewCount: 0,
        fiveStarCount: 0,
        fourStarCount: 0,
        threeStarCount: 0,
        twoStarCount: 0,
        oneStarCount: 0,
        verifiedCount: 0,
        lastCalculatedAt: new Date(),
      };
    }

    return {
      productId: summary.productId,
      averageRating: parseFloat(summary.averageRating),
      reviewCount: summary.reviewCount,
      fiveStarCount: summary.fiveStarCount,
      fourStarCount: summary.fourStarCount,
      threeStarCount: summary.threeStarCount,
      twoStarCount: summary.twoStarCount,
      oneStarCount: summary.oneStarCount,
      verifiedCount: summary.verifiedCount,
      lastCalculatedAt: summary.lastCalculatedAt,
    };
  }

  async recalculateSummary(productId: string) {
    // Aggregate over approved reviews for this product
    const [stats] = await db
      .select({
        reviewCount: sql<number>`count(*)::int`,
        averageRating: sql<number>`coalesce(round(avg(${reviews.rating}), 2), 0)::float`,
        fiveStarCount: sql<number>`count(case when ${reviews.rating} = 5 then 1 end)::int`,
        fourStarCount: sql<number>`count(case when ${reviews.rating} = 4 then 1 end)::int`,
        threeStarCount: sql<number>`count(case when ${reviews.rating} = 3 then 1 end)::int`,
        twoStarCount: sql<number>`count(case when ${reviews.rating} = 2 then 1 end)::int`,
        oneStarCount: sql<number>`count(case when ${reviews.rating} = 1 then 1 end)::int`,
        verifiedCount: sql<number>`count(case when ${reviews.isVerifiedPurchase} = true then 1 end)::int`,
      })
      .from(reviews)
      .where(
        and(eq(reviews.productId, productId), eq(reviews.status, "APPROVED")),
      );

    const reviewCount = stats?.reviewCount ?? 0;
    const averageRating = (stats?.averageRating ?? 0).toFixed(2);
    const fiveStarCount = stats?.fiveStarCount ?? 0;
    const fourStarCount = stats?.fourStarCount ?? 0;
    const threeStarCount = stats?.threeStarCount ?? 0;
    const twoStarCount = stats?.twoStarCount ?? 0;
    const oneStarCount = stats?.oneStarCount ?? 0;
    const verifiedCount = stats?.verifiedCount ?? 0;

    await db
      .insert(productRatingSummaries)
      .values({
        productId,
        averageRating,
        reviewCount,
        fiveStarCount,
        fourStarCount,
        threeStarCount,
        twoStarCount,
        oneStarCount,
        verifiedCount,
        lastCalculatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: productRatingSummaries.productId,
        set: {
          averageRating,
          reviewCount,
          fiveStarCount,
          fourStarCount,
          threeStarCount,
          twoStarCount,
          oneStarCount,
          verifiedCount,
          lastCalculatedAt: new Date(),
        },
      });

    return {
      productId,
      averageRating: parseFloat(averageRating),
      reviewCount,
      fiveStarCount,
      fourStarCount,
      threeStarCount,
      twoStarCount,
      oneStarCount,
      verifiedCount,
      lastCalculatedAt: new Date(),
    };
  }
}

export const summaryRepository = new SummaryRepository();
