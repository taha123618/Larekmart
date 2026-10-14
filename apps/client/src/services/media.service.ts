/**
 * media.service.ts — storefront client for media-service (:8013).
 *
 * Products reference media by id (`media:<uuid>` in the images JSON); URLs
 * are resolved dynamically so no storage internals leak into this app.
 * Legacy values (raw URLs) pass through untouched.
 *
 * Also hosts the authenticated avatar upload flow (presigned direct to
 * storage — binaries never traverse media-service's API).
 */

const MEDIA_BASE =
  process.env.NEXT_PUBLIC_MEDIA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const cache = new Map<string, string | null>();

/** Batch-resolves media references; results are memoized for the session. */
export async function resolveMediaUrls(
  refs: string[],
): Promise<Record<string, string | null>> {
  const missing = [...new Set(refs.filter(Boolean))].filter(
    (ref) =>
      !cache.has(ref) &&
      (ref.startsWith("media:") || /^[0-9a-f-]{36}$/i.test(ref)),
  );

  if (missing.length > 0) {
    try {
      const res = await fetch(`${MEDIA_BASE}/api/v1/media/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: missing }),
      });
      if (res.ok) {
        const data: { items: Record<string, string | null> } = await res.json();
        for (const [ref, url] of Object.entries(data.items ?? {})) {
          cache.set(ref, url);
        }
      }
    } catch {
      // media-service unavailable → fall through to cached/legacy values.
    }
  }

  const result: Record<string, string | null> = {};
  for (const ref of refs.filter(Boolean)) {
    if (cache.has(ref)) {
      result[ref] = cache.get(ref) ?? null;
    } else {
      // Not a media reference (legacy URL / local path) → passthrough.
      result[ref] = ref;
    }
  }
  return result;
}

export interface AvatarUploadResult {
  mediaId: string;
}

/**
 * Uploads a new avatar through the presigned direct-to-storage flow and
 * completes the session (starting async variant processing). Returns the
 * media reference (`media:<uuid>`) to persist as the profile's
 * avatarMediaId. The user-service profile update then announces
 * `user.avatar_uploaded` so media-service claims ownership.
 */
export async function uploadAvatar(
  file: File,
  ownerId: string,
  getToken: () => Promise<string | null>,
): Promise<AvatarUploadResult> {
  const token = await getToken();

  const createRes = await fetch(`${MEDIA_BASE}/api/v1/media/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ownerType: "user",
      ownerId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      category: "avatar",
      visibility: "PUBLIC",
    }),
  });

  if (!createRes.ok) {
    const detail = await createRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to create upload session");
  }

  const session = (await createRes.json()) as {
    mediaId: string;
    uploadUrl: string;
  };

  const putRes = await fetch(session.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) {
    throw new Error("Direct upload to storage failed");
  }

  const completeRes = await fetch(
    `${MEDIA_BASE}/api/v1/media/${session.mediaId}/complete`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!completeRes.ok) {
    const detail = await completeRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to complete upload");
  }

  return { mediaId: `media:${session.mediaId}` };
}

export interface ReviewMediaUploadResult {
  mediaId: string;
  mediaUrl: string;
  mediaType: string;
}

/**
 * Uploads a customer review attachment photo through the direct-to-storage flow.
 */
export async function uploadReviewPhoto(
  file: File,
  productId: string,
  getToken: () => Promise<string | null>,
): Promise<ReviewMediaUploadResult> {
  const token = await getToken();

  const createRes = await fetch(`${MEDIA_BASE}/api/v1/media/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ownerType: "review",
      ownerId: productId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      category: "review_attachment",
      visibility: "PUBLIC",
    }),
  });

  if (!createRes.ok) {
    const detail = await createRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to create upload session");
  }

  const session = (await createRes.json()) as {
    mediaId: string;
    uploadUrl: string;
  };

  const putRes = await fetch(session.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) {
    throw new Error("Direct upload to storage failed");
  }

  const completeRes = await fetch(
    `${MEDIA_BASE}/api/v1/media/${session.mediaId}/complete`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!completeRes.ok) {
    const detail = await completeRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to complete upload");
  }

  return {
    mediaId: session.mediaId,
    mediaUrl: `${MEDIA_BASE}/api/v1/media/${session.mediaId}`,
    mediaType: file.type,
  };
}
