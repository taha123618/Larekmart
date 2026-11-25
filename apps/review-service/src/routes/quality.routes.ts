import type { FastifyPluginAsync } from "fastify";
import {
  ImageModerationInputSchema,
  ReviewQualityInputSchema,
  evaluateReviewQuality,
  moderateReviewImage,
} from "../services/review-quality.service.js";

export const qualityRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/v1/reviews/quality/evaluate", async (request, reply) => {
    const parsed = ReviewQualityInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid review quality payload",
        issues: parsed.error.issues,
      });
    }
    return reply.send(evaluateReviewQuality(parsed.data));
  });

  app.post("/api/v1/reviews/moderation/image", async (request, reply) => {
    const parsed = ImageModerationInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid image moderation payload",
        issues: parsed.error.issues,
      });
    }
    return reply.send(moderateReviewImage(parsed.data));
  });
};
