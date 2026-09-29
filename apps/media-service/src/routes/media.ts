import { Hono } from "hono";
import {
  MediaIdParamsSchema,
  MediaOwnerParamsSchema,
  MediaUrlQuerySchema,
  MediaResolveRequestSchema,
} from "@repo/types";
import { shouldBeUser } from "../middleware/auth.js";
import {
  createRateLimiter,
  mediaRateLimitRules,
} from "../middleware/rate-limit.js";
import type { AuthVariables } from "../middleware/auth.js";
import { ValidationError } from "../errors/errors.js";
import { getServiceContainer } from "../container.js";

const mediaRoute = new Hono<{ Variables: AuthVariables }>();

function parseOr400<T>(result: {
  success: boolean;
  data?: T;
  error?: { issues: unknown };
}): T {
  if (!result.success) {
    throw new ValidationError(
      "Invalid request parameters",
      result.error?.issues,
    );
  }
  return result.data as T;
}

/**
 * GET /api/v1/media/:mediaId
 * Public metadata read. PRIVATE media requires owner/admin (enforced in the
 * service); the route resolves the actor when a session exists.
 */
mediaRoute.get("/:mediaId", async (c) => {
  const { mediaService } = getServiceContainer();
  const params = parseOr400(
    MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
  );
  const media = await mediaService.getMedia(
    params.mediaId,
    resolveOptionalActor(c),
  );
  return c.json(media);
});

/**
 * GET /api/v1/media/:mediaId/url?variant=thumbnail
 * Dynamic URL generation — presigned for PRIVATE, public URL for PUBLIC.
 */
mediaRoute.get(
  "/:mediaId/url",
  createRateLimiter(mediaRateLimitRules.urlGeneration),
  shouldBeUser,
  async (c) => {
    const { mediaService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const query = parseOr400(
      MediaUrlQuerySchema.safeParse({
        variant: c.req.query("variant") || undefined,
      }),
    );
    const actor = c.get("mediaActor");
    const result = await mediaService.getMediaUrl(
      params.mediaId,
      query.variant ?? null,
      actor,
    );
    return c.json({
      mediaId: params.mediaId,
      variant: query.variant ?? "original",
      url: result.url,
      expiresIn: result.expiresIn,
    });
  },
);

/**
 * GET /api/v1/media/owner/:ownerType/:ownerId
 * Storefront listing (READY media); private media filtered by actor.
 */
mediaRoute.get("/owner/:ownerType/:ownerId", async (c) => {
  const { mediaService } = getServiceContainer();
  const params = parseOr400(
    MediaOwnerParamsSchema.safeParse({
      ownerType: c.req.param("ownerType"),
      ownerId: c.req.param("ownerId"),
    }),
  );
  const limit = Number.parseInt(c.req.query("limit") ?? "50", 10);
  const offset = Number.parseInt(c.req.query("offset") ?? "0", 10);
  const result = await mediaService.listByOwner(
    params.ownerType,
    params.ownerId,
    resolveOptionalActor(c),
    {
      limit: Number.isFinite(limit) ? Math.min(limit, 200) : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    },
  );
  return c.json({ items: result.items, total: result.total });
});

/**
 * POST /api/v1/media/resolve
 * Batch-resolves media references to URLs. Accepts the mixed values products
 * actually store (`color → mediaId`) plus legacy raw URLs; unknown ids and
 * raw URLs pass through unchanged so existing products keep rendering.
 * Public: only PUBLIC/PROTECTED media resolve; PRIVATE ids return null urls.
 */
mediaRoute.post(
  "/resolve",
  createRateLimiter(mediaRateLimitRules.urlGeneration),
  async (c) => {
    const { mediaService } = getServiceContainer();
    const body = await c.req.json().catch(() => null);
    const parsed = MediaResolveRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid resolve request", parsed.error.issues);
    }

    const resolved = await mediaService.resolveMany(parsed.data.ids, null);
    return c.json({ items: resolved });
  },
);

/**
 * DELETE /api/v1/media/:mediaId — soft delete (recovery window before purge).
 */
mediaRoute.delete(
  "/:mediaId",
  createRateLimiter(mediaRateLimitRules.deleteMedia),
  shouldBeUser,
  async (c) => {
    const { mediaService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const actor = c.get("mediaActor");
    await mediaService.softDelete(params.mediaId, actor);
    return c.json({ message: "Media deleted" }, 200);
  },
);

/** Resolves the authenticated actor when present, without forcing auth. */
function resolveOptionalActor(c: { get: (key: string) => unknown }): {
  userId: string;
  role: "user" | "admin";
} | null {
  const actor = c.get("mediaActor");
  if (
    actor &&
    typeof actor === "object" &&
    "userId" in actor &&
    typeof (actor as { userId: unknown }).userId === "string"
  ) {
    return actor as { userId: string; role: "user" | "admin" };
  }
  return null;
}

export default mediaRoute;
