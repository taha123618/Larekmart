import { Hono } from "hono";
import { MediaIdParamsSchema, MediaListQuerySchema } from "@repo/types";
import { shouldBeAdmin } from "../middleware/auth.js";
import {
  createRateLimiter,
  mediaRateLimitRules,
} from "../middleware/rate-limit.js";
import type { AuthVariables } from "../middleware/auth.js";
import { ValidationError, NotFoundError } from "../errors/errors.js";
import { getServiceContainer } from "../container.js";

const adminRoute = new Hono<{ Variables: AuthVariables }>();

function parseOr400<T>(result: {
  success: boolean;
  data?: T;
  error?: { issues: unknown };
}): T {
  if (!result.success) {
    throw new ValidationError("Invalid request", result.error?.issues);
  }
  return result.data as T;
}

/** GET /api/v1/admin/media — list media across owners. */
adminRoute.get(
  "/media",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  async (c) => {
    const { mediaService } = getServiceContainer();
    const query = parseOr400(
      MediaListQuerySchema.safeParse({
        status: c.req.query("status") || undefined,
        limit: c.req.query("limit") || undefined,
        offset: c.req.query("offset") || undefined,
      }),
    );
    const result = await mediaService.listByOwner(
      c.req.query("ownerType") ?? "",
      c.req.query("ownerId") ?? "",
      c.get("mediaActor"),
      { limit: query.limit, offset: query.offset, status: query.status },
    );
    return c.json({ items: result.items, total: result.total });
  },
);

/** POST /api/v1/admin/media/:mediaId/reprocess — re-enqueue a processing job. */
adminRoute.post(
  "/media/:mediaId/reprocess",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  async (c) => {
    const { adminService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const job = await adminService.reprocess(params.mediaId);
    return c.json({ message: "Reprocessing queued", jobId: job.id }, 202);
  },
);

/** POST /api/v1/admin/media/:mediaId/restore — undo a soft delete. */
adminRoute.post(
  "/media/:mediaId/restore",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  async (c) => {
    const { adminService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const restored = await adminService.restore(params.mediaId);
    if (!restored) throw new NotFoundError();
    return c.json({ message: "Media restored" });
  },
);

/** DELETE /api/v1/admin/media/:mediaId/purge — permanent binary + metadata removal. */
adminRoute.delete(
  "/media/:mediaId/purge",
  createRateLimiter(mediaRateLimitRules.admin),
  shouldBeAdmin,
  async (c) => {
    const { adminService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    await adminService.purge(params.mediaId);
    return c.json({ message: "Media purged" });
  },
);

export default adminRoute;
