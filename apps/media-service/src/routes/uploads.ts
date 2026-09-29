import { Hono } from "hono";
import { shouldBeUser } from "../middleware/auth.js";
import {
  createRateLimiter,
  mediaRateLimitRules,
} from "../middleware/rate-limit.js";
import type { AuthVariables } from "../middleware/auth.js";
import { getServiceContainer } from "../container.js";

const uploadsRoute = new Hono<{ Variables: AuthVariables }>();

/**
 * POST /api/v1/media/uploads
 * Creates a media record + presigned PUT URL. The client uploads directly
 * to S3/MinIO — binaries never traverse this API (spec section 8).
 */
uploadsRoute.post(
  "/uploads",
  createRateLimiter(mediaRateLimitRules.uploadCreate),
  shouldBeUser,
  async (c) => {
    const { uploadService } = getServiceContainer();
    const actor = c.get("mediaActor");
    const body = await c.req.json().catch(() => null);

    const result = await uploadService.createUpload(body, actor);
    return c.json(result, 201);
  },
);

/**
 * POST /api/v1/media/:mediaId/complete
 * Verifies the stored object, transitions PENDING → UPLOADING → PROCESSING,
 * publishes media.uploaded, and enqueues the Sharp processing job.
 */
uploadsRoute.post(
  "/:mediaId/complete",
  createRateLimiter(mediaRateLimitRules.uploadComplete),
  shouldBeUser,
  async (c) => {
    const { uploadService } = getServiceContainer();
    const actor = c.get("mediaActor");
    const mediaId = c.req.param("mediaId");

    const result = await uploadService.completeUpload(mediaId, actor);
    return c.json(result);
  },
);

export default uploadsRoute;
