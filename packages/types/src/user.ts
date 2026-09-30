import { z } from "zod";

// ==========================================
// User Enums
// ==========================================

export const UserStatusEnum = z.enum([
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
  "PENDING_VERIFICATION",
]);
export type UserStatusType = z.infer<typeof UserStatusEnum>;

export const AddressTypeEnum = z.enum(["SHIPPING", "BILLING", "BOTH"]);
export type AddressType = z.infer<typeof AddressTypeEnum>;

// ==========================================
// Profile Schemas & Types
// ==========================================

import { MediaRefSchema } from "./media";
export { MediaRefSchema };

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(100).optional(),
  /** Legacy avatar URL (Clerk or external). Prefer avatarMediaId. */
  avatarUrl: z
    .string()
    .url("Invalid avatar URL format")
    .max(1000)
    .optional()
    .nullable(),
  /** Media reference for the avatar; wins over avatarUrl when both are set. */
  avatarMediaId: MediaRefSchema.optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z.string().max(50).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  displayName: z.string().nullable(),
  /** Legacy avatar URL (Clerk or external). New avatars use avatarMediaId. */
  avatarUrl: z.string().nullable(),
  /** Media reference (`media:<uuid>`) resolved via media-service. */
  avatarMediaId: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  bio: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;

// ==========================================
// Address Schemas & Types
// ==========================================

export const CreateAddressSchema = z.object({
  type: AddressTypeEnum.default("SHIPPING"),
  label: z.string().max(50).optional().nullable(),
  recipientName: z.string().min(1, "Recipient name is required").max(150),
  phone: z.string().min(5, "Phone number is required").max(30),
  addressLine1: z.string().min(1, "Address line 1 is required").max(255),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(2).max(100).default("US"),
  isDefault: z.boolean().default(false),
});
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;

export const UpdateAddressSchema = CreateAddressSchema.partial();
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;

export const AddressResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: AddressTypeEnum,
  label: z.string().nullable(),
  recipientName: z.string(),
  phone: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AddressResponse = z.infer<typeof AddressResponseSchema>;

// ==========================================
// Preferences Schemas & Types
// ==========================================

export const UpdatePreferencesSchema = z.object({
  preferredLanguage: z.string().min(2).max(10).optional(),
  currency: z.string().min(3).max(10).optional(),
  timezone: z.string().min(1).max(50).optional(),
  marketingEmail: z.boolean().optional(),
  marketingSms: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  productRecommendations: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

export const UserPreferencesResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  preferredLanguage: z.string(),
  currency: z.string(),
  timezone: z.string(),
  marketingEmail: z.boolean(),
  marketingSms: z.boolean(),
  pushNotifications: z.boolean(),
  productRecommendations: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserPreferencesResponse = z.infer<
  typeof UserPreferencesResponseSchema
>;

// ==========================================
// Settings Schemas & Types
// ==========================================

export const UpdateSettingsSchema = z.object({
  twoFactorPrompt: z.boolean().optional(),
  profileVisibility: z.enum(["public", "private", "contacts"]).optional(),
  orderUpdatesEmail: z.boolean().optional(),
  orderUpdatesSms: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

export const UserSettingsResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  twoFactorPrompt: z.boolean(),
  profileVisibility: z.string(),
  orderUpdatesEmail: z.boolean(),
  orderUpdatesSms: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserSettingsResponse = z.infer<typeof UserSettingsResponseSchema>;

// ==========================================
// Account & User Core Schemas & Types
// ==========================================

export const UpdateUserAccountSchema = z.object({
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email("Invalid email format").optional(),
});
export type UpdateUserAccountInput = z.infer<typeof UpdateUserAccountSchema>;

export const AdminUpdateUserStatusSchema = z.object({
  status: UserStatusEnum,
});
export type AdminUpdateUserStatusInput = z.infer<
  typeof AdminUpdateUserStatusSchema
>;

export const UserDetailResponseSchema = z.object({
  id: z.string(),
  authUserId: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  status: UserStatusEnum,
  profile: UserProfileResponseSchema.nullable().optional(),
  preferences: UserPreferencesResponseSchema.nullable().optional(),
  settings: UserSettingsResponseSchema.nullable().optional(),
  addresses: z.array(AddressResponseSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserDetailResponse = z.infer<typeof UserDetailResponseSchema>;

// ==========================================
// Kafka User Domain Events
// ==========================================

export const UserEventNameSchema = z.enum([
  "user.created",
  "user.updated",
  "user.profile_updated",
  "user.avatar_uploaded",
  "user.address_created",
  "user.address_updated",
  "user.address_deleted",
  "user.preferences_updated",
  "user.deleted",
  "user.deletion_requested",
]);
export type UserEventName = z.infer<typeof UserEventNameSchema>;

export const UserEventPayloadSchema = z.object({
  eventId: z.string(),
  eventType: UserEventNameSchema,
  userId: z.string(),
  authUserId: z.string().optional(),
  timestamp: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type UserEventPayload = z.infer<typeof UserEventPayloadSchema>;
