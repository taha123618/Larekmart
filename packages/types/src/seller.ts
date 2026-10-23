import { z } from "zod";

// ==============================================================================
// 1. Core Domain Enums & Values
// ==============================================================================

export const SellerStatusEnum = {
  ONBOARDING: "ONBOARDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  INACTIVE: "INACTIVE",
} as const;

export type SellerStatus =
  (typeof SellerStatusEnum)[keyof typeof SellerStatusEnum];

export const SellerStatusSchema = z.enum([
  SellerStatusEnum.ONBOARDING,
  SellerStatusEnum.ACTIVE,
  SellerStatusEnum.SUSPENDED,
  SellerStatusEnum.INACTIVE,
]);

export const StorefrontStatusEnum = {
  ACTIVE: "ACTIVE",
  VACATION: "VACATION",
  MAINTENANCE: "MAINTENANCE",
  CLOSED: "CLOSED",
} as const;

export type StorefrontStatus =
  (typeof StorefrontStatusEnum)[keyof typeof StorefrontStatusEnum];

export const StorefrontStatusSchema = z.enum([
  StorefrontStatusEnum.ACTIVE,
  StorefrontStatusEnum.VACATION,
  StorefrontStatusEnum.MAINTENANCE,
  StorefrontStatusEnum.CLOSED,
]);

export const StaffRoleEnum = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  CATALOG_SPECIALIST: "CATALOG_SPECIALIST",
  FULFILLMENT_OPERATOR: "FULFILLMENT_OPERATOR",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
} as const;

export type StaffRole = (typeof StaffRoleEnum)[keyof typeof StaffRoleEnum];

export const StaffRoleSchema = z.enum([
  StaffRoleEnum.OWNER,
  StaffRoleEnum.MANAGER,
  StaffRoleEnum.CATALOG_SPECIALIST,
  StaffRoleEnum.FULFILLMENT_OPERATOR,
  StaffRoleEnum.CUSTOMER_SUPPORT,
]);

export const StaffStatusEnum = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
} as const;

export type StaffStatus =
  (typeof StaffStatusEnum)[keyof typeof StaffStatusEnum];

export const StaffStatusSchema = z.enum([
  StaffStatusEnum.INVITED,
  StaffStatusEnum.ACTIVE,
  StaffStatusEnum.SUSPENDED,
  StaffStatusEnum.REVOKED,
]);

export const PolicyTypeEnum = {
  SHIPPING: "SHIPPING",
  RETURNS: "RETURNS",
  PRIVACY: "PRIVACY",
  TERMS: "TERMS",
} as const;

export type PolicyType = (typeof PolicyTypeEnum)[keyof typeof PolicyTypeEnum];

export const PolicyTypeSchema = z.enum([
  PolicyTypeEnum.SHIPPING,
  PolicyTypeEnum.RETURNS,
  PolicyTypeEnum.PRIVACY,
  PolicyTypeEnum.TERMS,
]);

export interface SellerStore {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  headline?: string | null;
  description?: string | null;
  logoMediaId?: string | null;
  bannerMediaId?: string | null;
  vacationMode?: boolean;
  vacationMessage?: string | null;
  vacationEndDate?: string | null;
  status: StorefrontStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SellerPolicy {
  id: string;
  sellerId: string;
  policyType: PolicyType;
  title: string;
  content: string;
  version: number;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerStaff {
  id: string;
  sellerId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: StaffRole;
  permissions: string[];
  status: StaffStatus;
  joinedAt: string;
  updatedAt: string;
}

export interface SellerSettings {
  id: string;
  sellerId: string;
  defaultCurrency: string;
  shippingOriginPostalCode?: string | null;
  autoAcceptOrders: boolean;
  lowStockThreshold: number;
  supportEmail?: string | null;
  supportPhone?: string | null;
  notificationPreferences?: Record<string, boolean> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerPerformanceSnapshot {
  id: string;
  sellerId: string;
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  fulfilledOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  grossMerchandiseValue: number;
  averageRating: number;
  fulfillmentRate: number;
  onTimeDeliveryRate: number;
  cancellationRate: number;
  returnRate: number;
  sellerScore: number;
  calculatedAt: string;
}

export interface Seller {
  id: string;
  vendorId: string;
  ownerUserId: string;
  status: SellerStatus;
  primaryCurrency: string;
  onboardedAt?: string | null;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  store?: SellerStore | null;
  policies?: SellerPolicy[];
  staff?: SellerStaff[];
  settings?: SellerSettings | null;
  latestPerformance?: SellerPerformanceSnapshot | null;
}

// ==============================================================================
// 2. Schemas & Input DTOs
// ==============================================================================

export const CreateSellerSchema = z.object({
  vendorId: z.string().min(1, "Vendor organization ID is required"),
  storeName: z
    .string()
    .min(2, "Store name must be at least 2 characters")
    .max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens",
    )
    .optional(),
  headline: z.string().max(200).optional().nullable(),
  description: z.string().max(3000).optional().nullable(),
  logoMediaId: z.string().optional().nullable(),
  bannerMediaId: z.string().optional().nullable(),
});

export type CreateSellerInput = z.infer<typeof CreateSellerSchema>;

export const UpdateSellerSchema = z.object({
  status: SellerStatusSchema.optional(),
  reason: z.string().max(500).optional(),
  primaryUserId: z.string().min(1).optional(),
});

export type UpdateSellerInput = z.infer<typeof UpdateSellerSchema>;

export const UpdateStorefrontSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  headline: z.string().max(200).optional().nullable(),
  description: z.string().max(3000).optional().nullable(),
  logoMediaId: z.string().optional().nullable(),
  bannerMediaId: z.string().optional().nullable(),
  vacationMode: z.boolean().optional(),
  vacationMessage: z.string().max(500).optional().nullable(),
  vacationEndDate: z.string().datetime().optional().nullable(),
  status: StorefrontStatusSchema.optional(),
});

export type UpdateStorefrontInput = z.infer<typeof UpdateStorefrontSchema>;

export const AddStaffSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  role: StaffRoleSchema.default(StaffRoleEnum.MANAGER),
  permissions: z.array(z.string()).default([]),
});

export type AddStaffInput = z.infer<typeof AddStaffSchema>;

export const UpdateSellerSettingsSchema = z.object({
  defaultCurrency: z.string().length(3).default("USD"),
  shippingOriginPostalCode: z.string().max(20).optional().nullable(),
  autoAcceptOrders: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).default(5),
  supportEmail: z.string().email().optional().nullable(),
  supportPhone: z.string().max(30).optional().nullable(),
  notificationPreferences: z
    .record(z.string(), z.boolean())
    .optional()
    .nullable(),
});

export type UpdateSellerSettingsInput = z.infer<
  typeof UpdateSellerSettingsSchema
>;

export const UpsertPolicySchema = z.object({
  policyType: PolicyTypeSchema,
  title: z.string().min(2).max(100),
  content: z.string().min(10).max(10000),
});

export type UpsertPolicyInput = z.infer<typeof UpsertPolicySchema>;

// ==============================================================================
// 3. Kafka Event Topics & Payloads
// ==============================================================================

export const SELLER_TOPICS = {
  CREATED: "seller.created",
  ACTIVATED: "seller.activated",
  UPDATED: "seller.updated",
  SUSPENDED: "seller.suspended",
  STOREFRONT_UPDATED: "seller.storefront.updated",
} as const;

export type SellerTopic = (typeof SELLER_TOPICS)[keyof typeof SELLER_TOPICS];

export const SellerCreatedEventSchema = z.object({
  sellerId: z.string(),
  vendorId: z.string(),
  primaryUserId: z.string(),
  storeName: z.string(),
  slug: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export type SellerCreatedEvent = z.infer<typeof SellerCreatedEventSchema>;

export const SellerActivatedEventSchema = z.object({
  sellerId: z.string(),
  vendorId: z.string(),
  activatedAt: z.string(),
  activatedByUserId: z.string().optional().nullable(),
});

export type SellerActivatedEvent = z.infer<typeof SellerActivatedEventSchema>;

export const SellerUpdatedEventSchema = z.object({
  sellerId: z.string(),
  updatedFields: z.array(z.string()),
  updatedAt: z.string(),
});

export type SellerUpdatedEvent = z.infer<typeof SellerUpdatedEventSchema>;

export const SellerSuspendedEventSchema = z.object({
  sellerId: z.string(),
  vendorId: z.string(),
  reason: z.string(),
  suspendedAt: z.string(),
  suspendedByUserId: z.string().optional().nullable(),
});

export type SellerSuspendedEvent = z.infer<typeof SellerSuspendedEventSchema>;

export const SellerStorefrontUpdatedEventSchema = z.object({
  sellerId: z.string(),
  storeId: z.string(),
  storeName: z.string(),
  slug: z.string(),
  vacationMode: z.boolean(),
  status: z.string(),
  updatedAt: z.string(),
});

export type SellerStorefrontUpdatedEvent = z.infer<
  typeof SellerStorefrontUpdatedEventSchema
>;

// ==============================================================================
// 8. Platform System Settings (Project-Wide Super Admin Controls)
// ==============================================================================

export const SystemSettingsSchema = z.object({
  id: z.string(),
  isSellerEnabled: z.boolean(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable().optional(),
});

export type SystemSettings = z.infer<typeof SystemSettingsSchema>;

export const UpdateSystemSettingsSchema = z.object({
  isSellerEnabled: z.boolean({
    message: "isSellerEnabled is required",
  }),
});

export type UpdateSystemSettingsInput = z.infer<
  typeof UpdateSystemSettingsSchema
>;
