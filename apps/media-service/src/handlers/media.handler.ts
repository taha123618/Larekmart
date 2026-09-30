import type { Context } from "hono";
import {
  MediaIdParamsSchema,
  MediaOwnerParamsSchema,
  MediaUrlQuerySchema,
  MediaResolveRequestSchema,
  MediaGenerateVariantsRequestSchema,
} from "../schemas/media.schema.js";
import { ValidationError, ForbiddenError } from "../errors/errors.js";
import { getServiceContainer } from "../container.js";
import type { AuthVariables } from "../middleware/auth.js";
import type { MediaActor } from "../services/media.service.js";

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

export function resolveOptionalActor(
  c: Context<{ Variables: AuthVariables }>,
): MediaActor | null {
  const actor = c.get("mediaActor");
  if (
    actor &&
    typeof actor === "object" &&
    "userId" in actor &&
    typeof (actor as { userId: unknown }).userId === "string"
  ) {
    return actor as MediaActor;
  }
  return null;
}

export class MediaHandler {
  /** GET /api/v1/media/:mediaId */
  static async getMedia(c: Context<{ Variables: AuthVariables }>) {
    const { mediaService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const media = await mediaService.getMedia(
      params.mediaId,
      resolveOptionalActor(c),
    );
    return c.json(media);
  }

  /** GET /api/v1/media/:mediaId/url */
  static async getMediaUrl(c: Context<{ Variables: AuthVariables }>) {
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
  }

  /** GET /api/v1/media/owner/:ownerType/:ownerId */
  static async listByOwner(c: Context<{ Variables: AuthVariables }>) {
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
  }

  /** POST /api/v1/media/resolve */
  static async resolveMany(c: Context<{ Variables: AuthVariables }>) {
    const { mediaService } = getServiceContainer();
    const body = await c.req.json().catch(() => null);
    const parsed = MediaResolveRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid resolve request", parsed.error.issues);
    }

    const resolved = await mediaService.resolveMany(parsed.data.ids, null);
    return c.json({ items: resolved });
  }

  /** POST /api/v1/media/:mediaId/variants (Spec section 26) */
  static async generateVariants(c: Context<{ Variables: AuthVariables }>) {
    const { mediaService, variantService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const actor = c.get("mediaActor");
    const media = await mediaService.getMedia(params.mediaId, actor);

    // Verify actor can manage the media (owner or admin)
    if (actor.role !== "admin" && media.createdBy !== actor.userId) {
      throw new ForbiddenError(
        "Not authorized to generate variants for this media",
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = MediaGenerateVariantsRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid variant generation request",
        parsed.error.issues,
      );
    }

    const generated = await variantService.generateVariantsForMedia(
      params.mediaId,
      {
        variantNames: parsed.data.variants,
        force: parsed.data.force,
      },
    );

    const updatedMedia = await mediaService.getMedia(params.mediaId, actor);
    return c.json({
      message: "Variants generated successfully",
      mediaId: params.mediaId,
      variants: generated.map((v) => ({
        variant: v.variant,
        mimeType: v.mimeType,
        width: v.width,
        height: v.height,
        sizeBytes: v.sizeBytes,
      })),
      media: updatedMedia,
    });
  }

  /** DELETE /api/v1/media/:mediaId */
  static async deleteMedia(c: Context<{ Variables: AuthVariables }>) {
    const { mediaService } = getServiceContainer();
    const params = parseOr400(
      MediaIdParamsSchema.safeParse({ mediaId: c.req.param("mediaId") }),
    );
    const actor = c.get("mediaActor");
    await mediaService.softDelete(params.mediaId, actor);
    return c.json({ message: "Media deleted" }, 200);
  }
}
