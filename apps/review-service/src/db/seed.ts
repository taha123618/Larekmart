import { db } from "./connection.js";
import {
  purchaseEligibility,
  reviews,
  reviewVotes,
  sellerResponses,
  productRatingSummaries,
} from "./schema.js";
import { sql } from "drizzle-orm";

export async function seedReviewData() {
  console.log(
    "Seeding initial data for review-service (larekmart_review_db)...",
  );

  // Sample verified buyers
  const buyers = [
    { userId: "user_buyer_sarah", name: "Sarah Khan" },
    { userId: "user_buyer_ahmed", name: "Ahmed Raza" },
    { userId: "user_buyer_elena", name: "Elena Rostova" },
    { userId: "user_buyer_zayd", name: "Zayd Ali" },
  ];

  // Target products present in product catalog
  const products = [
    { id: "101", name: "Air Runner" },
    { id: "102", name: "Trail Boot" },
    { id: "103", name: "Ghost Sneaker" },
    { id: "1", name: "Adidas CoreFit T-Shirt" },
    { id: "2", name: "Puma Ultra Warm Zip" },
  ];

  // 1. Seed Purchase Eligibility
  console.log("  → Seeding purchase eligibility records...");
  for (const product of products) {
    for (let i = 0; i < buyers.length; i++) {
      const buyer = buyers[i]!;
      await db
        .insert(purchaseEligibility)
        .values({
          userId: buyer.userId,
          productId: product.id,
          orderId: `ord_seed_${product.id}_${buyer.userId}`,
          orderItemId: `item_seed_${product.id}_${buyer.userId}`,
          deliveredAt: new Date(Date.now() - (i + 1) * 86400000 * 3), // Delivered 3-12 days ago
          hasReviewed: true,
        })
        .onConflictDoNothing();
    }
  }

  // 2. Seed Reviews
  console.log("  → Seeding verified product reviews...");
  const sampleReviews = [
    {
      productId: "101",
      userId: "user_buyer_sarah",
      authorName: "Sarah Khan",
      rating: 5,
      title: "Extremely comfortable for marathon training!",
      content:
        "The cushioning on the Air Runner is sublime. I have logged over 50 miles in these and have zero blisters. Highly recommended for daily training.",
      helpfulCount: 14,
      unhelpfulCount: 0,
    },
    {
      productId: "101",
      userId: "user_buyer_ahmed",
      authorName: "Ahmed Raza",
      rating: 4,
      title: "Great shoe, runs half a size small",
      content:
        "Breathability and sole support are top notch. Make sure to size up by half a size if you have wide feet.",
      helpfulCount: 8,
      unhelpfulCount: 1,
    },
    {
      productId: "102",
      userId: "user_buyer_elena",
      authorName: "Elena Rostova",
      rating: 5,
      title: "Indestructible trail grip in heavy mud",
      content:
        "Took these on a 15-mile rocky scramble in wet terrain. Deep-lug traction prevented any slipping, and water resistance kept socks bone dry.",
      helpfulCount: 22,
      unhelpfulCount: 1,
    },
    {
      productId: "102",
      userId: "user_buyer_zayd",
      authorName: "Zayd Ali",
      rating: 5,
      title: "Ankle support is phenomenal",
      content:
        "Best hiking boot I've purchased this season. Solid construction, durable eyelets, and very comfortable insoles.",
      helpfulCount: 11,
      unhelpfulCount: 0,
    },
    {
      productId: "103",
      userId: "user_buyer_sarah",
      authorName: "Sarah Khan",
      rating: 4,
      title: "Sleek minimalist aesthetics",
      content:
        "Very clean silhouette for casual outfits. Sole is slightly firm but softens up after a couple of days of walking.",
      helpfulCount: 5,
      unhelpfulCount: 0,
    },
    {
      productId: "1",
      userId: "user_buyer_ahmed",
      authorName: "Ahmed Raza",
      rating: 5,
      title: "Premium moisture-wicking fabric",
      content:
        "Holds shape and color perfectly even after dozens of machine washes. Ideal workout tee.",
      helpfulCount: 9,
      unhelpfulCount: 0,
    },
    {
      productId: "2",
      userId: "user_buyer_elena",
      authorName: "Elena Rostova",
      rating: 5,
      title: "Keeps warm in freezing morning runs",
      content:
        "Warm yet lightweight. Thumbholes on the sleeves and zippered pockets are very practical.",
      helpfulCount: 7,
      unhelpfulCount: 0,
    },
  ];

  for (const rev of sampleReviews) {
    const inserted = await db
      .insert(reviews)
      .values({
        productId: rev.productId,
        userId: rev.userId,
        authorName: rev.authorName,
        rating: rev.rating,
        title: rev.title,
        content: rev.content,
        isVerifiedPurchase: true,
        status: "APPROVED",
        helpfulCount: rev.helpfulCount,
        unhelpfulCount: rev.unhelpfulCount,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) {
      // 3. Seed Seller Response for one of the reviews
      if (rev.productId === "101" && rev.rating === 4) {
        await db
          .insert(sellerResponses)
          .values({
            reviewId: inserted[0].id,
            sellerId: "seller_official_store",
            content:
              "Thank you for your valuable feedback, Ahmed! We appreciate the note on sizing and have updated our size recommendations on the product page.",
          })
          .onConflictDoNothing();
      }

      // 4. Seed sample helpful votes
      await db
        .insert(reviewVotes)
        .values({
          reviewId: inserted[0].id,
          userId: "user_reviewer_voter_1",
          voteType: "HELPFUL",
        })
        .onConflictDoNothing();
    }
  }

  // 5. Calculate and Seed Product Rating Summaries
  console.log("  → Calculating and updating rating summaries...");
  for (const product of products) {
    const res = await db.execute(sql`
      SELECT
        COUNT(*)::int as total,
        COALESCE(AVG(rating), 0)::numeric as avg_rating,
        COUNT(*) FILTER (WHERE rating = 5)::int as five_star,
        COUNT(*) FILTER (WHERE rating = 4)::int as four_star,
        COUNT(*) FILTER (WHERE rating = 3)::int as three_star,
        COUNT(*) FILTER (WHERE rating = 2)::int as two_star,
        COUNT(*) FILTER (WHERE rating = 1)::int as one_star,
        COUNT(*) FILTER (WHERE is_verified_purchase = true)::int as verified_count
      FROM reviews
      WHERE product_id = ${product.id} AND status = 'APPROVED'
    `);

    const row = res.rows[0] as any;
    if (row && row.total > 0) {
      await db
        .insert(productRatingSummaries)
        .values({
          productId: product.id,
          averageRating: Number(
            parseFloat(row.avg_rating).toFixed(2),
          ).toString(),
          reviewCount: row.total,
          fiveStarCount: row.five_star,
          fourStarCount: row.four_star,
          threeStarCount: row.three_star,
          twoStarCount: row.two_star,
          oneStarCount: row.one_star,
          verifiedCount: row.verified_count,
        })
        .onConflictDoUpdate({
          target: productRatingSummaries.productId,
          set: {
            averageRating: Number(
              parseFloat(row.avg_rating).toFixed(2),
            ).toString(),
            reviewCount: row.total,
            fiveStarCount: row.five_star,
            fourStarCount: row.four_star,
            threeStarCount: row.three_star,
            twoStarCount: row.two_star,
            oneStarCount: row.one_star,
            verifiedCount: row.verified_count,
            lastCalculatedAt: new Date(),
          },
        });
    }
  }

  console.log("review-service database seeding completed successfully.");
}

if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  seedReviewData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
