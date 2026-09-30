import { Hono } from "hono";
import { shouldBeAdmin } from "../middleware/auth.js";
import {
  createRateLimiter,
  mediaRateLimitRules,
} from "../middleware/rate-limit.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AdminHandler } from "../handlers/admin.handler.js";

const adminRoute = new Hono<{ Variables: AuthVariables }>();

/** GET /api/v1/admin/media — list media across owners. */
adminRoute.get(
  "/media",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  AdminHandler.listMedia,
);

/** POST /api/v1/admin/media/:mediaId/reprocess — re-enqueue a processing job. */
adminRoute.post(
  "/media/:mediaId/reprocess",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  AdminHandler.reprocess,
);

/** POST /api/v1/admin/media/:mediaId/restore — undo a soft delete. */
adminRoute.post(
  "/media/:mediaId/restore",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  AdminHandler.restore,
);

/** DELETE /api/v1/admin/media/:mediaId/purge — permanent binary + metadata removal. */
adminRoute.delete(
  "/media/:mediaId/purge",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  AdminHandler.purge,
);

export default adminRoute;
