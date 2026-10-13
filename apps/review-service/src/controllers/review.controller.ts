import type { FastifyRequest, FastifyReply } from "fastify";
import { reviewService } from "../services/review.service.js";
import { summaryService } from "../services/summary.service.js";
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  VoteReviewSchema,
  ReportReviewSchema,
  CreateSellerResponseSchema,
  ReviewQuerySchema,
} from "@repo/types";

export class ReviewController {
  async createReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = (request.params as { productId?: string }) || {};
      const body = (request.body as Record<string, any>) || {};
      const productId = params.productId || body.productId;

      if (!productId) {
        return reply
          .status(400)
          .send({ message: "productId is required in route params or body" });
      }

      const userId = request.userId!;
      const authorName = request.userName || "Verified Customer";

      const parsed = CreateReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const review = await reviewService.createReview(
        productId,
        userId,
        authorName,
        parsed.data,
      );

      return reply.status(201).send(review);
    } catch (err: any) {
      const status = err.message.includes("must purchase")
        ? 403
        : err.message.includes("already submitted")
          ? 409
          : 400;
      return reply.status(status).send({ message: err.message });
    }
  }

  async getProductReviews(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = (request.params as { productId?: string }) || {};
      const query = (request.query as Record<string, any>) || {};
      const productId = params.productId || query.productId;

      if (!productId) {
        return reply
          .status(400)
          .send({ message: "productId is required in route params or query" });
      }

      const parsed = ReviewQuerySchema.safeParse(request.query);

      const filters = parsed.success
        ? parsed.data
        : { page: 1, limit: 20, sort: "newest" as const };

      const result = await reviewService.getProductReviews(productId, filters);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  }

  async getReviewById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const review = await reviewService.getReviewById(reviewId);
      return reply.send(review);
    } catch (err: any) {
      return reply.status(404).send({ message: err.message });
    }
  }

  async getUserReviews(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.userId!;
      const query = request.query as { page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const result = await reviewService.getUserReviews(userId, page, limit);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  }

  async updateReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const userId = request.userId!;

      const parsed = UpdateReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const updated = await reviewService.updateReview(
        reviewId,
        userId,
        parsed.data,
      );
      return reply.send(updated);
    } catch (err: any) {
      const status = err.message.includes("not authorized")
        ? 403
        : err.message.includes("not found")
          ? 404
          : 400;
      return reply.status(status).send({ message: err.message });
    }
  }

  async deleteReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const userId = request.userId!;
      const isAdmin = request.userRole === "admin";

      await reviewService.deleteReview(reviewId, userId, isAdmin);
      return reply.send({ message: "Review deleted successfully." });
    } catch (err: any) {
      const status = err.message.includes("not authorized")
        ? 403
        : err.message.includes("not found")
          ? 404
          : 400;
      return reply.status(status).send({ message: err.message });
    }
  }

  async voteReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const userId = request.userId!;

      const parsed = VoteReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await reviewService.voteReview(
        reviewId,
        userId,
        parsed.data.voteType,
      );
      return reply.send(result);
    } catch (err: any) {
      const status = err.message.includes("cannot vote on your own")
        ? 400
        : err.message.includes("not found")
          ? 404
          : 500;
      return reply.status(status).send({ message: err.message });
    }
  }

  async reportReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const userId = request.userId!;

      const parsed = ReportReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await reviewService.reportReview(
        reviewId,
        userId,
        parsed.data.reason,
        parsed.data.details,
      );
      return reply.send(result);
    } catch (err: any) {
      return reply
        .status(err.message.includes("not found") ? 404 : 400)
        .send({ message: err.message });
    }
  }

  async getRatingSummary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = (request.params as { productId?: string }) || {};
      const query = (request.query as Record<string, any>) || {};
      const productId = params.productId || query.productId;

      if (!productId) {
        return reply
          .status(400)
          .send({ message: "productId is required in route params or query" });
      }

      const summary = await summaryService.getProductRatingSummary(productId);
      return reply.send(summary);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  }

  async addSellerResponse(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const sellerId = request.userId!;

      const parsed = CreateSellerResponseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const response = await reviewService.addSellerResponse(
        reviewId,
        sellerId,
        parsed.data.content,
      );
      return reply.send(response);
    } catch (err: any) {
      return reply
        .status(err.message.includes("not found") ? 404 : 400)
        .send({ message: err.message });
    }
  }
}

export const reviewController = new ReviewController();
