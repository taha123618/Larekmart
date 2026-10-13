import type { FastifyInstance } from "fastify";
import { reviewController } from "../controllers/review.controller.js";
import { shouldBeUser } from "../middleware/auth.middleware.js";

export async function reviewRoutes(fastify: FastifyInstance) {
  // Public routes
  fastify.get(
    "/api/v1/products/:productId/reviews",
    reviewController.getProductReviews.bind(reviewController),
  );

  fastify.get(
    "/api/v1/products/:productId/rating-summary",
    reviewController.getRatingSummary.bind(reviewController),
  );

  fastify.get(
    "/api/v1/reviews",
    reviewController.getProductReviews.bind(reviewController),
  );

  fastify.get(
    "/api/v1/reviews/products/:productId",
    reviewController.getProductReviews.bind(reviewController),
  );

  fastify.get(
    "/api/v1/reviews/products/:productId/rating-summary",
    reviewController.getRatingSummary.bind(reviewController),
  );

  fastify.get(
    "/api/v1/reviews/:reviewId",
    reviewController.getReviewById.bind(reviewController),
  );

  // Authenticated customer routes
  fastify.post(
    "/api/v1/products/:productId/reviews",
    { preHandler: [shouldBeUser] },
    reviewController.createReview.bind(reviewController),
  );

  fastify.post(
    "/api/v1/reviews",
    { preHandler: [shouldBeUser] },
    reviewController.createReview.bind(reviewController),
  );

  fastify.get(
    "/api/v1/me/reviews",
    { preHandler: [shouldBeUser] },
    reviewController.getUserReviews.bind(reviewController),
  );

  fastify.patch(
    "/api/v1/reviews/:reviewId",
    { preHandler: [shouldBeUser] },
    reviewController.updateReview.bind(reviewController),
  );

  fastify.delete(
    "/api/v1/reviews/:reviewId",
    { preHandler: [shouldBeUser] },
    reviewController.deleteReview.bind(reviewController),
  );

  fastify.post(
    "/api/v1/reviews/:reviewId/votes",
    { preHandler: [shouldBeUser] },
    reviewController.voteReview.bind(reviewController),
  );

  fastify.post(
    "/api/v1/reviews/:reviewId/reports",
    { preHandler: [shouldBeUser] },
    reviewController.reportReview.bind(reviewController),
  );

  // Seller response route
  fastify.post(
    "/api/v1/reviews/:reviewId/response",
    { preHandler: [shouldBeUser] },
    reviewController.addSellerResponse.bind(reviewController),
  );
}
