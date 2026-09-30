import { Hono } from "hono";
import { shouldBeUser } from "../middleware/auth.js";
import {
  createRateLimiter,
  mediaRateLimitRules,
} from "../middleware/rate-limit.js";
import type { AuthVariables } from "../middleware/auth.js";
import { MediaHandler } from "../handlers/media.handler.js";

const mediaRoute = new Hono<{ Variables: AuthVariables }>();

/**
 * GET /api/v1/media/:mediaId
 * Public metadata read. PRIVATE media requires owner/admin (enforced in the
 * service); the route resolves the actor when a session exists.
 */
mediaRoute.get("/:mediaId", MediaHandler.getMedia);

/**
 * GET /api/v1/media/:mediaId/url?variant=thumbnail
 * Dynamic URL generation — presigned for PRIVATE, public URL for PUBLIC.
 */
mediaRoute.get(
  "/:mediaId/url",
  createRateLimiter(mediaRateLimitRules.urlGeneration),
  shouldBeUser,
  MediaHandler.getMediaUrl,
);

/**
 * GET /api/v1/media/owner/:ownerType/:ownerId
 * Storefront listing (READY media); private media filtered by actor.
 */
mediaRoute.get("/owner/:ownerType/:ownerId", MediaHandler.listByOwner);

/**
 * POST /api/v1/media/resolve
 * Batch-resolves media references to URLs. Accepts the mixed values products
 * actually store (`color → mediaId`) plus legacy raw URLs.
 */
mediaRoute.post(
  "/resolve",
  createRateLimiter(mediaRateLimitRules.urlGeneration),
  MediaHandler.resolveMany,
);

/**
 * POST /api/v1/media/:mediaId/variants (Spec section 26)
 * Generates or regenerates variants for an existing media asset.
 */
mediaRoute.post(
  "/:mediaId/variants",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeUser,
  MediaHandler.generateVariants,
);

/**
 * DELETE /api/v1/media/:mediaId — soft delete (recovery window before purge).
 */
mediaRoute.delete(
  "/:mediaId",
  createRateLimiter(mediaRateLimitRules.deleteMedia),
  shouldBeUser,
  MediaHandler.deleteMedia,
);

export default mediaRoute;
