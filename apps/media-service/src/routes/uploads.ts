import { Hono } from "hono";
import { shouldBeUser } from "../middleware/auth.js";
import {
  createRateLimiter,
  mediaRateLimitRules,
} from "../middleware/rate-limit.js";
import type { AuthVariables } from "../middleware/auth.js";
import { UploadHandler } from "../handlers/upload.handler.js";

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
  UploadHandler.createUpload,
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
  UploadHandler.completeUpload,
);

/**
 * POST /api/v1/media/:mediaId/abort
 * Aborts an active upload session.
 */
uploadsRoute.post(
  "/:mediaId/abort",
  createRateLimiter(mediaRateLimitRules.uploadComplete),
  shouldBeUser,
  UploadHandler.abortUpload,
);

export default uploadsRoute;
