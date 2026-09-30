import { z } from "zod";
export {
  MediaStatusEnum,
  MediaVisibilityEnum,
  MediaOwnerTypeEnum,
  MediaVariantEnum,
  MediaProcessingJobTypeEnum,
  MediaProcessingJobStatusEnum,
  MediaUploadSessionStatusEnum,
  MediaUploadRequestSchema,
  MediaResponseSchema,
  MediaUploadUrlResponseSchema,
  MediaIdParamsSchema,
  MediaOwnerParamsSchema,
  MediaListQuerySchema,
  MediaUrlQuerySchema,
  MediaResolveRequestSchema,
  MediaResolveResponseSchema,
  type MediaStatusType,
  type MediaVisibilityType,
  type MediaOwnerTypeType,
  type MediaVariantType,
  type MediaProcessingJobTypeType,
  type MediaProcessingJobStatusType,
  type MediaUploadSessionStatusType,
  type MediaUploadRequestType,
  type MediaResponseType,
  type MediaUploadUrlResponseType,
  type MediaResolveRequestType,
  type MediaResolveResponseType,
} from "@repo/types";

/**
 * Request body for POST /api/v1/media/:mediaId/variants
 */
export const MediaGenerateVariantsRequestSchema = z.object({
  variants: z
    .array(z.enum(["thumbnail", "small", "medium", "large", "logo", "avatar"]))
    .optional(),
  force: z.boolean().optional().default(false),
});

export type MediaGenerateVariantsRequestType = z.infer<
  typeof MediaGenerateVariantsRequestSchema
>;
