import { ref } from "vue";
import { useApi } from "./useApi";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export interface PresignedUploadResponse {
  mediaId: string;
  uploadUrl: string;
  publicUrl?: string;
}

/**
 * Uploads a product or storefront image directly to S3/MinIO via media-service
 * presigned PUT URLs, enforcing allowlisted MIME types and 5MB size bounds.
 */
export function useMediaUpload() {
  const api = useApi();
  const isUploading = ref(false);
  const uploadError = ref<string | null>(null);

  const uploadMedia = async (
    file: File,
    ownerType: "product" | "seller" = "product",
    ownerId?: string,
  ): Promise<{ mediaId: string; url: string | null } | null> => {
    uploadError.value = null;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      uploadError.value = "Only JPEG, PNG, and WebP images are supported.";
      return null;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      uploadError.value = "Image file size must not exceed 5MB.";
      return null;
    }

    isUploading.value = true;
    try {
      const initRes = await api.post<PresignedUploadResponse>("/api/v1/media/uploads", {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        ownerType,
        ownerId,
      });

      const putRes = await fetch(initRes.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Storage upload failed (${putRes.status})`);
      }

      await api.post(`/api/v1/media/${initRes.mediaId}/complete`, {});

      if (initRes.publicUrl) {
        return { mediaId: initRes.mediaId, url: initRes.publicUrl };
      }

      const urlRes = await api.get<{ url?: string }>(`/api/v1/media/${initRes.mediaId}/url`);
      return { mediaId: initRes.mediaId, url: urlRes?.url || null };
    } catch (err: unknown) {
      uploadError.value =
        err instanceof Error ? err.message : "Failed to upload image.";
      return null;
    } finally {
      isUploading.value = false;
    }
  };

  const uploadImage = async (
    file: File,
    ownerType: "product" | "seller" = "product",
    ownerId?: string,
  ): Promise<string | null> => {
    const result = await uploadMedia(file, ownerType, ownerId);
    return result?.url || null;
  };

  return {
    isUploading,
    uploadError,
    uploadMedia,
    uploadImage,
  };
}
