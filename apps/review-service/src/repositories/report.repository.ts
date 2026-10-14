import { eq, sql, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { reviewReports, reviews } from "../db/schema.js";

export class ReportRepository {
  async createReport(
    reviewId: string,
    userId: string,
    reason: string,
    details?: string,
  ) {
    const [report] = await db
      .insert(reviewReports)
      .values({
        reviewId,
        userId,
        reason,
        details: details || null,
        status: "OPEN",
      })
      .returning();

    if (!report) {
      throw new Error("Failed to create review report");
    }

    return report;
  }

  async getReportCount(reviewId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewReports)
      .where(eq(reviewReports.reviewId, reviewId));

    return result?.count ?? 0;
  }

  async flagReviewIfThresholdReached(
    reviewId: string,
    threshold = 3,
  ): Promise<boolean> {
    const count = await this.getReportCount(reviewId);
    if (count >= threshold) {
      await db
        .update(reviews)
        .set({ status: "FLAGGED", updatedAt: new Date() })
        .where(eq(reviews.id, reviewId));
      return true;
    }
    return false;
  }

  async getAllReports(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const items = await db
      .select({
        id: reviewReports.id,
        reviewId: reviewReports.reviewId,
        userId: reviewReports.userId,
        reason: reviewReports.reason,
        details: reviewReports.details,
        status: reviewReports.status,
        createdAt: reviewReports.createdAt,
        reviewContent: reviews.content,
        reviewRating: reviews.rating,
        reviewStatus: reviews.status,
        productId: reviews.productId,
      })
      .from(reviewReports)
      .leftJoin(reviews, eq(reviewReports.reviewId, reviews.id))
      .orderBy(desc(reviewReports.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(reviewReports);

    const total = countResult?.total ?? 0;
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const reportRepository = new ReportRepository();
