import { eq, sql } from "drizzle-orm";
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
}

export const reportRepository = new ReportRepository();
