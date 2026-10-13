import {
  reviewRepository,
  type ReviewFilters,
} from "../repositories/review.repository.js";
import { eligibilityRepository } from "../repositories/eligibility.repository.js";
import { voteRepository } from "../repositories/vote.repository.js";
import { reportRepository } from "../repositories/report.repository.js";
import { summaryService } from "./summary.service.js";
import {
  publishReviewCreated,
  publishReviewUpdated,
  publishReviewDeleted,
  publishReviewApproved,
  publishReviewRejected,
  publishReviewReported,
} from "../publishers/review.publisher.js";
import { env } from "../config/env.js";
import type {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewStatus,
} from "@repo/types";

const SUSPICIOUS_KEYWORDS = [
  "scam",
  "fake",
  "fraud",
  "http://",
  "https://",
  "free money",
  "whatsapp",
  "telegram",
];

function checkSpamOrAbuse(text: string): boolean {
  const lower = text.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some((word) => lower.includes(word));
}

export class ReviewService {
  async createReview(
    productId: string,
    userId: string,
    authorName: string,
    input: CreateReviewInput,
  ) {
    // 1. Verify purchase eligibility
    const eligibility = await eligibilityRepository.findByUserAndProduct(
      userId,
      productId,
    );
    if (!eligibility) {
      throw new Error(
        "You must purchase and receive this product before submitting a review.",
      );
    }
    if (eligibility.hasReviewed) {
      throw new Error("You have already submitted a review for this product.");
    }

    // 2. Hybrid moderation check
    const isSuspicious =
      checkSpamOrAbuse(input.title) || checkSpamOrAbuse(input.content);

    let status: ReviewStatus = "APPROVED";
    if (isSuspicious) {
      status = "FLAGGED";
    } else if (!env.AUTO_APPROVE_VERIFIED) {
      status = "PENDING";
    }

    // 3. Persist review
    const review = await reviewRepository.createReview({
      productId,
      userId,
      authorName,
      orderId: eligibility.orderId,
      rating: input.rating,
      title: input.title,
      content: input.content,
      isVerifiedPurchase: true,
      status,
      media: input.media,
    });

    // 4. Mark purchase eligibility as reviewed
    await eligibilityRepository.markAsReviewed(userId, productId);

    // 5. Update rating summary if approved
    if (status === "APPROVED") {
      await summaryService.recalculateAndPublish(productId);
    }

    // 6. Publish Kafka event
    await publishReviewCreated({
      reviewId: review.id!,
      productId: review.productId!,
      userId: review.userId!,
      rating: review.rating!,
      title: review.title!,
      isVerifiedPurchase: review.isVerifiedPurchase ?? true,
      status: (review.status || "APPROVED") as ReviewStatus,
      createdAt: (review.createdAt || new Date()).toISOString(),
    });

    return review;
  }

  async getProductReviews(productId: string, filters: ReviewFilters) {
    return await reviewRepository.getReviewsByProduct(productId, filters);
  }

  async getReviewById(reviewId: string) {
    const review = await reviewRepository.getReviewById(reviewId);
    if (!review) {
      throw new Error("Review not found.");
    }
    return review;
  }

  async getUserReviews(userId: string, page = 1, limit = 20) {
    return await reviewRepository.getUserReviews(userId, page, limit);
  }

  async updateReview(
    reviewId: string,
    userId: string,
    input: UpdateReviewInput,
  ) {
    const existing = await reviewRepository.getReviewById(reviewId);
    if (!existing) {
      throw new Error("Review not found.");
    }
    if (existing.userId !== userId) {
      throw new Error("You are not authorized to update this review.");
    }

    const updated = await reviewRepository.updateReview(
      reviewId,
      userId,
      input,
    );
    if (!updated) {
      throw new Error("Failed to update review.");
    }

    if (existing.status === "APPROVED") {
      await summaryService.recalculateAndPublish(existing.productId);
    }

    await publishReviewUpdated({
      reviewId: updated.id!,
      productId: updated.productId!,
      userId: updated.userId!,
      rating: updated.rating!,
      title: updated.title!,
      updatedAt: (updated.updatedAt || new Date()).toISOString(),
    });

    return updated;
  }

  async deleteReview(reviewId: string, userId?: string, isAdmin = false) {
    const existing = await reviewRepository.getReviewById(reviewId);
    if (!existing) {
      throw new Error("Review not found.");
    }

    if (!isAdmin && existing.userId !== userId) {
      throw new Error("You are not authorized to delete this review.");
    }

    const deleted = await reviewRepository.deleteReview(
      reviewId,
      isAdmin ? undefined : userId,
    );
    if (!deleted) {
      throw new Error("Failed to delete review.");
    }

    if (existing.status === "APPROVED") {
      await summaryService.recalculateAndPublish(existing.productId);
    }

    await publishReviewDeleted({
      reviewId: deleted.id,
      productId: deleted.productId,
      userId: deleted.userId,
      deletedAt: new Date().toISOString(),
    });

    return deleted;
  }

  async voteReview(
    reviewId: string,
    userId: string,
    voteType: "HELPFUL" | "UNHELPFUL",
  ) {
    const review = await reviewRepository.getReviewById(reviewId);
    if (!review) {
      throw new Error("Review not found.");
    }
    if (review.userId === userId) {
      throw new Error("You cannot vote on your own review.");
    }

    const result = await voteRepository.castVote(reviewId, userId, voteType);
    const updatedReview = await reviewRepository.getReviewById(reviewId);

    return {
      action: result.action,
      voteType: result.voteType,
      helpfulCount: updatedReview?.helpfulCount ?? 0,
      unhelpfulCount: updatedReview?.unhelpfulCount ?? 0,
    };
  }

  async reportReview(
    reviewId: string,
    userId: string,
    reason: "SPAM" | "ABUSIVE" | "OFF_TOPIC" | "FAKE_REVIEW" | "OTHER",
    details?: string,
  ) {
    const review = await reviewRepository.getReviewById(reviewId);
    if (!review) {
      throw new Error("Review not found.");
    }

    const report = await reportRepository.createReport(
      reviewId,
      userId,
      reason,
      details,
    );
    const flagged = await reportRepository.flagReviewIfThresholdReached(
      reviewId,
      env.REPORT_FLAG_THRESHOLD,
    );

    if (flagged && review.status === "APPROVED") {
      await summaryService.recalculateAndPublish(review.productId);
    }

    const totalReportCount = await reportRepository.getReportCount(reviewId);

    await publishReviewReported({
      reportId: report.id,
      reviewId,
      productId: review.productId,
      userId,
      reason,
      totalReportCount,
      status: flagged ? "FLAGGED" : (review.status as ReviewStatus),
      reportedAt: report.createdAt.toISOString(),
    });

    return {
      reportId: report.id,
      status: flagged ? "FLAGGED" : review.status,
      message: "Report submitted successfully.",
    };
  }

  async addSellerResponse(reviewId: string, sellerId: string, content: string) {
    const review = await reviewRepository.getReviewById(reviewId);
    if (!review) {
      throw new Error("Review not found.");
    }

    return await reviewRepository.addSellerResponse(
      reviewId,
      sellerId,
      content,
    );
  }

  async getAdminReviews(status?: string, page = 1, limit = 20) {
    return await reviewRepository.getAdminReviews(status, page, limit);
  }

  async moderateReview(
    reviewId: string,
    moderatorId: string,
    action: "APPROVE" | "REJECT" | "FLAG" | "ANONYMIZE",
    reason: string,
  ) {
    const existing = await reviewRepository.getReviewById(reviewId);
    if (!existing) {
      throw new Error("Review not found.");
    }

    const updated = await reviewRepository.moderateReview(
      reviewId,
      moderatorId,
      action,
      reason,
    );

    if (!updated) {
      throw new Error("Failed to moderate review.");
    }

    await summaryService.recalculateAndPublish(existing.productId);

    if (action === "APPROVE") {
      await publishReviewApproved({
        reviewId,
        productId: existing.productId,
        moderatorId,
        approvedAt: new Date().toISOString(),
      });
    } else if (action === "REJECT") {
      await publishReviewRejected({
        reviewId,
        productId: existing.productId,
        moderatorId,
        reason,
        rejectedAt: new Date().toISOString(),
      });
    }

    return updated;
  }
}

export const reviewService = new ReviewService();
