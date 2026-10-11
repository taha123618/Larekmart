import type { Context } from "hono";
import { getServiceContainer } from "../container.js";
import type { AuthVariables } from "../middleware/auth.js";

export class UploadHandler {
  /**
   * POST /api/v1/media/uploads
   * Creates a media record + presigned PUT URL. The client uploads directly
   * to S3/MinIO — binaries never traverse this API (spec section 8).
   */
  static async createUpload(c: Context<{ Variables: AuthVariables }>) {
    const { uploadService } = getServiceContainer();
    const actor = c.get("mediaActor");
    const body = await c.req.json().catch(() => null);

    const result = await uploadService.createUpload(body, actor);
    return c.json(result, 201);
  }

  /**
   * POST /api/v1/media/:mediaId/complete
   * Verifies the stored object, transitions PENDING → UPLOADING → PROCESSING,
   * publishes media.uploaded, and enqueues the Sharp processing job.
   */
  static async completeUpload(c: Context<{ Variables: AuthVariables }>) {
    const { uploadService } = getServiceContainer();
    const actor = c.get("mediaActor");
    const mediaId = c.req.param("mediaId");
    if (!mediaId) {
      return c.json({ message: "Media ID is required" }, 400);
    }

    const result = await uploadService.completeUpload(mediaId, actor);
    return c.json(result);
  }

  /**
   * POST /api/v1/media/:mediaId/abort
   * Cancels the upload session and marks the media FAILED.
   */
  static async abortUpload(c: Context<{ Variables: AuthVariables }>) {
    const { uploadService } = getServiceContainer();
    const actor = c.get("mediaActor");
    const mediaId = c.req.param("mediaId");
    if (!mediaId) {
      return c.json({ message: "Media ID is required" }, 400);
    }

    await uploadService.abortUpload(mediaId, actor);
    return c.json({ message: "Upload session aborted" });
  }
}
