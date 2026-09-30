import type { Context } from "hono";
import {
  MediaIdParamsSchema,
  MediaListQuerySchema,
} from "../schemas/media.schema.js";
import { ValidationError, NotFoundError } from "../errors/errors.js";
import { getServiceContainer } from "../container.js";
import type { AuthVariables } from "../middleware/auth.js";

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

export class AdminHandler {
  /** GET /api/v1/admin/media — list media across owners. */
  static async listMedia(c: Context<{ Variables: AuthVariables }>) {
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
  }

  /** POST /api/v1/admin/media/:mediaId/reprocess — re-enqueue a processing job. */
  static async reprocess(c: Context<{ Variables: AuthVariables }>) {
    const { adminService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const job = await adminService.reprocess(params.mediaId);
    return c.json({ message: "Reprocessing queued", jobId: job.id }, 202);
  }

  /** POST /api/v1/admin/media/:mediaId/restore — undo a soft delete. */
  static async restore(c: Context<{ Variables: AuthVariables }>) {
    const { adminService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const restored = await adminService.restore(params.mediaId);
    if (!restored) throw new NotFoundError();
    return c.json({ message: "Media restored" });
  }

  /** DELETE /api/v1/admin/media/:mediaId/purge — permanent binary + metadata removal. */
  static async purge(c: Context<{ Variables: AuthVariables }>) {
    const { adminService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    await adminService.purge(params.mediaId);
    return c.json({ message: "Media purged" });
  }
}
