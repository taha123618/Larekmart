import type { FastifyRequest, FastifyReply } from "fastify";
import { reviewService } from "../services/review.service.js";
import { summaryService } from "../services/summary.service.js";
import { ModerateReviewSchema } from "@repo/types";

export class AdminController {
  async getAdminReviews(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        status?: string;
        page?: string;
        limit?: string;
      };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const result = await reviewService.getAdminReviews(
        query.status,
        page,
        limit,
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  }

  async moderateReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const moderatorId = request.userId!;

      const parsed = ModerateReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const updated = await reviewService.moderateReview(
        reviewId,
        moderatorId,
        parsed.data.action,
        parsed.data.reason,
      );

      return reply.send(updated);
    } catch (err: any) {
      return reply
        .status(err.message.includes("not found") ? 404 : 400)
        .send({ message: err.message });
    }
  }

  async getReports(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const result = await reviewService.getReports(page, limit);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  }

  async getSummaries(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const result = await summaryService.getAllSummaries(page, limit);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  }

  async recalculateSummaries(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = (request.body || {}) as { productId?: string };
      if (body.productId) {
        const summary = await summaryService.recalculateAndPublish(
          body.productId,
        );
        return reply.send({ success: true, summary });
      }
      const result = await summaryService.recalculateAll();
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  }
}

export const adminController = new AdminController();
