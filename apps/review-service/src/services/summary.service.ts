import { summaryRepository } from "../repositories/summary.repository.js";
import { reviewCache } from "../cache/review-cache.js";
import { publishRatingSummaryUpdated } from "../publishers/review.publisher.js";
import type { ProductRatingSummary } from "@repo/types";

export class SummaryService {
  async getProductRatingSummary(
    productId: string,
  ): Promise<ProductRatingSummary> {
    const cached = await reviewCache.getSummary(productId);
    if (cached) {
      return cached;
    }

    const summary = await summaryRepository.getSummary(productId);
    await reviewCache.setSummary(productId, summary);
    return summary;
  }

  async recalculateAndPublish(
    productId: string,
  ): Promise<ProductRatingSummary> {
    const summary = await summaryRepository.recalculateSummary(productId);
    await reviewCache.setSummary(productId, summary);

    await publishRatingSummaryUpdated({
      productId: summary.productId,
      averageRating: summary.averageRating,
      reviewCount: summary.reviewCount,
      distribution: {
        1: summary.oneStarCount,
        2: summary.twoStarCount,
        3: summary.threeStarCount,
        4: summary.fourStarCount,
        5: summary.fiveStarCount,
      },
      verifiedCount: summary.verifiedCount,
      updatedAt: summary.lastCalculatedAt.toISOString(),
    });

    return summary;
  }
}

export const summaryService = new SummaryService();
