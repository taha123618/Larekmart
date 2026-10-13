import type { FastifyInstance } from "fastify";
import { adminController } from "../controllers/admin.controller.js";
import { shouldBeAdmin } from "../middleware/auth.middleware.js";

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/v1/admin/reviews",
    { preHandler: [shouldBeAdmin] },
    adminController.getAdminReviews.bind(adminController),
  );

  fastify.get(
    "/api/v1/admin/reviews/reports",
    { preHandler: [shouldBeAdmin] },
    adminController.getReports.bind(adminController),
  );

  fastify.get(
    "/api/v1/admin/reviews/summaries",
    { preHandler: [shouldBeAdmin] },
    adminController.getSummaries.bind(adminController),
  );

  fastify.post(
    "/api/v1/admin/reviews/summaries/recalculate",
    { preHandler: [shouldBeAdmin] },
    adminController.recalculateSummaries.bind(adminController),
  );

  fastify.patch(
    "/api/v1/admin/reviews/:reviewId/moderation",
    { preHandler: [shouldBeAdmin] },
    adminController.moderateReview.bind(adminController),
  );
}
