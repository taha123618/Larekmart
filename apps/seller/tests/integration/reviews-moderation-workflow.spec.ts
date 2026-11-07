import { describe, it, expect } from "vitest";

interface Review {
  id: string;
  productId: string;
  sellerId: string;
  rating: number; // 1 to 5
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  sellerResponse?: {
    content: string;
    respondedAt: string;
  };
  createdAt: string;
}

interface ReviewRatingSummary {
  totalReviews: number;
  averageRating: number;
  verifiedCount: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

function calculateReviewSummary(reviews: Review[]): ReviewRatingSummary {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      verifiedCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  let totalScore = 0;
  let verifiedCount = 0;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const review of reviews) {
    totalScore += review.rating;
    if (review.isVerifiedPurchase) {
      verifiedCount += 1;
    }
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
  }

  const averageRating = Math.round((totalScore / reviews.length) * 10) / 10;

  return {
    totalReviews: reviews.length,
    averageRating,
    verifiedCount,
    distribution,
  };
}

function createSellerReply(params: {
  review: Review;
  sellerUserId: string;
  replyContent: string;
}): { isValid: boolean; updatedReview?: Review; error?: string } {
  const content = params.replyContent.trim();
  if (content.length < 5) {
    return { isValid: false, error: "Reply must be at least 5 characters" };
  }
  if (content.length > 2000) {
    return { isValid: false, error: "Reply cannot exceed 2000 characters" };
  }
  if (params.review.sellerId !== params.sellerUserId) {
    return { isValid: false, error: "Unauthorized: You can only reply to reviews on your products" };
  }

  const updatedReview: Review = {
    ...params.review,
    sellerResponse: {
      content,
      respondedAt: new Date().toISOString(),
    },
  };

  return { isValid: true, updatedReview };
}

describe("Reviews, Ratings & Seller Moderation (Integration)", () => {
  it("calculates accurate rating metrics and star distributions", () => {
    const reviews: Review[] = [
      {
        id: "rev_1",
        productId: "prod_1",
        sellerId: "sel_1",
        rating: 5,
        title: "Outstanding build quality",
        comment: "Exceeded my expectations!",
        isVerifiedPurchase: true,
        createdAt: "2026-07-01T10:00:00Z",
      },
      {
        id: "rev_2",
        productId: "prod_1",
        sellerId: "sel_1",
        rating: 5,
        title: "Fast shipping",
        comment: "Delivered in under 24 hours.",
        isVerifiedPurchase: true,
        createdAt: "2026-07-02T11:00:00Z",
      },
      {
        id: "rev_3",
        productId: "prod_1",
        sellerId: "sel_1",
        rating: 4,
        title: "Good value",
        comment: "Packaging was slightly dented but item is pristine.",
        isVerifiedPurchase: false,
        createdAt: "2026-07-03T12:00:00Z",
      },
      {
        id: "rev_4",
        productId: "prod_1",
        sellerId: "sel_1",
        rating: 2,
        title: "Color mismatch",
        comment: "Item was darker than pictured.",
        isVerifiedPurchase: true,
        createdAt: "2026-07-04T13:00:00Z",
      },
    ];

    const summary = calculateReviewSummary(reviews);

    expect(summary.totalReviews).toBe(4);
    // (5 + 5 + 4 + 2) / 4 = 16 / 4 = 4.0
    expect(summary.averageRating).toBe(4.0);
    expect(summary.verifiedCount).toBe(3);
    expect(summary.distribution[5]).toBe(2);
    expect(summary.distribution[4]).toBe(1);
    expect(summary.distribution[2]).toBe(1);
    expect(summary.distribution[1]).toBe(0);
  });

  it("enforces seller ownership and content bounds when replying to reviews", () => {
    const review: Review = {
      id: "rev_10",
      productId: "prod_mechanical_keyboard",
      sellerId: "sel_my_store",
      rating: 3,
      title: "Keycap font",
      comment: "Font is a bit small",
      isVerifiedPurchase: true,
      createdAt: "2026-07-05T10:00:00Z",
    };

    // Reject too short
    const shortReply = createSellerReply({
      review,
      sellerUserId: "sel_my_store",
      replyContent: "Thx",
    });
    expect(shortReply.isValid).toBe(false);
    expect(shortReply.error).toContain("at least 5 characters");

    // Reject wrong seller (IDOR attempt)
    const unauthorizedReply = createSellerReply({
      review,
      sellerUserId: "sel_attacker_store",
      replyContent: "Thank you for the constructive feedback!",
    });
    expect(unauthorizedReply.isValid).toBe(false);
    expect(unauthorizedReply.error).toContain("Unauthorized");

    // Accept valid owner response
    const validReply = createSellerReply({
      review,
      sellerUserId: "sel_my_store",
      replyContent: "Thank you for your feedback! We will update the keycap printing in our next production batch.",
    });
    expect(validReply.isValid).toBe(true);
    expect(validReply.updatedReview?.sellerResponse?.content).toContain("keycap printing");
    expect(validReply.updatedReview?.sellerResponse?.respondedAt).toBeDefined();
  });
});
