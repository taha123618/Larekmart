"use client";

/**
 * media.service.ts — admin-side client for media-service (:8013).
 *
 * Uploads use the presigned direct-to-storage flow: the browser PUTs the
 * file straight to S3/MinIO; binaries never pass through the API service.
 * Products reference media by `mediaId` — never by storage URL.
 */

const MEDIA_BASE =
  process.env.NEXT_PUBLIC_MEDIA_SERVICE_URL || "http://localhost:8013";

export interface MediaUploadResponse {
  mediaId: string;
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  expiresAt: string;
  media: {
    id: string;
    status: string;
    visibility: string;
  };
}

export interface MediaResolveResponse {
  items: Record<string, string | null>;
}

/**
 * Creates a media record + presigned upload URL, uploads the file directly
 * to object storage, then completes the session (starts async variant
 * processing). Returns the mediaId products should reference.
 */
export async function uploadProductImage(
  file: File,
  productIdHint: string,
  getToken: () => Promise<string | null>,
): Promise<string> {
  const token = await getToken();

  // 1. Create the upload session (validation + authorization happen here).
  const createRes = await fetch(`${MEDIA_BASE}/api/v1/media/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ownerType: "product",
      // Product rows are created after their images upload; the media claim
      // consumer reassigns ownership when product.created arrives. The hint
      // keeps draft media grouped under a stable owner id meanwhile.
      ownerId: productIdHint,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      category: "product-image",
      visibility: "PUBLIC",
    }),
  });

  if (!createRes.ok) {
    const detail = await createRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to create upload session");
  }

  const session: MediaUploadResponse = await createRes.json();

  // 2. Upload directly to S3/MinIO with the presigned URL.
  const putRes = await fetch(session.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) {
    throw new Error("Direct upload to storage failed");
  }

  // 3. Complete the session → verify object + enqueue processing.
  const completeRes = await fetch(
    `${MEDIA_BASE}/api/v1/media/${session.mediaId}/complete`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!completeRes.ok) {
    const detail = await completeRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to complete upload");
  }

  return session.mediaId;
}

/** Batch-resolves media references (`media:<uuid>` or legacy URLs) to URLs. */
export async function resolveMediaUrls(
  refs: string[],
): Promise<Record<string, string | null>> {
  if (refs.length === 0) return {};
  try {
    const res = await fetch(`${MEDIA_BASE}/api/v1/media/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: refs }),
    });
    if (!res.ok) return {};
    const data: MediaResolveResponse = await res.json();
    return data.items ?? {};
  } catch {
    // media-service unavailable → callers render fallbacks.
    return {};
  }
}
