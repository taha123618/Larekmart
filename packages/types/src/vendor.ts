import { z } from "zod";

// ==============================================================================
// 1. Core Domain Enums & Values
// ==============================================================================

export const VendorStatusEnum = {
  DRAFT: "DRAFT",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  TERMINATED: "TERMINATED",
  DEACTIVATED: "DEACTIVATED",
} as const;

export type VendorStatus =
  (typeof VendorStatusEnum)[keyof typeof VendorStatusEnum];

export const VendorStatusSchema = z.enum([
  VendorStatusEnum.DRAFT,
  VendorStatusEnum.PENDING_VERIFICATION,
  VendorStatusEnum.VERIFIED,
  VendorStatusEnum.REJECTED,
  VendorStatusEnum.SUSPENDED,
  VendorStatusEnum.TERMINATED,
  VendorStatusEnum.DEACTIVATED,
]);

export const OrganizationTypeEnum = {
  CORPORATION: "CORPORATION",
  LLC: "LLC",
  PARTNERSHIP: "PARTNERSHIP",
  SOLE_PROPRIETORSHIP: "SOLE_PROPRIETORSHIP",
} as const;

export type OrganizationType =
  (typeof OrganizationTypeEnum)[keyof typeof OrganizationTypeEnum];

export const OrganizationTypeSchema = z.enum([
  OrganizationTypeEnum.CORPORATION,
  OrganizationTypeEnum.LLC,
  OrganizationTypeEnum.PARTNERSHIP,
  OrganizationTypeEnum.SOLE_PROPRIETORSHIP,
]);

export const DocumentTypeEnum = {
  BUSINESS_REGISTRATION: "BUSINESS_REGISTRATION",
  TAX_CERTIFICATE: "TAX_CERTIFICATE",
  PROOF_OF_ADDRESS: "PROOF_OF_ADDRESS",
  ARTICLES_OF_INCORPORATION: "ARTICLES_OF_INCORPORATION",
  DIRECTOR_ID: "DIRECTOR_ID",
  BANK_STATEMENT: "BANK_STATEMENT",
} as const;

export type DocumentType =
  (typeof DocumentTypeEnum)[keyof typeof DocumentTypeEnum];

export const DocumentTypeSchema = z.enum([
  DocumentTypeEnum.BUSINESS_REGISTRATION,
  DocumentTypeEnum.TAX_CERTIFICATE,
  DocumentTypeEnum.PROOF_OF_ADDRESS,
  DocumentTypeEnum.ARTICLES_OF_INCORPORATION,
  DocumentTypeEnum.DIRECTOR_ID,
  DocumentTypeEnum.BANK_STATEMENT,
]);

export const DocumentVerificationStatusEnum = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;

export type DocumentVerificationStatus =
  (typeof DocumentVerificationStatusEnum)[keyof typeof DocumentVerificationStatusEnum];

export const DocumentVerificationStatusSchema = z.enum([
  DocumentVerificationStatusEnum.PENDING,
  DocumentVerificationStatusEnum.ACCEPTED,
  DocumentVerificationStatusEnum.REJECTED,
]);

export const VerificationWorkflowTypeEnum = {
  MANUAL_ADMIN: "MANUAL_ADMIN",
  AUTOMATED_KYB: "AUTOMATED_KYB",
  EXTERNAL_PROVIDER: "EXTERNAL_PROVIDER",
} as const;

export type VerificationWorkflowType =
  (typeof VerificationWorkflowTypeEnum)[keyof typeof VerificationWorkflowTypeEnum];

export const VerificationWorkflowTypeSchema = z.enum([
  VerificationWorkflowTypeEnum.MANUAL_ADMIN,
  VerificationWorkflowTypeEnum.AUTOMATED_KYB,
  VerificationWorkflowTypeEnum.EXTERNAL_PROVIDER,
]);

export const VerificationStatusEnum = {
  INITIATED: "INITIATED",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export type VerificationStatus =
  (typeof VerificationStatusEnum)[keyof typeof VerificationStatusEnum];

export const VerificationStatusSchema = z.enum([
  VerificationStatusEnum.INITIATED,
  VerificationStatusEnum.IN_REVIEW,
  VerificationStatusEnum.APPROVED,
  VerificationStatusEnum.REJECTED,
  VerificationStatusEnum.EXPIRED,
]);

export const MemberRoleEnum = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  COMPLIANCE_OFFICER: "COMPLIANCE_OFFICER",
  MEMBER: "MEMBER",
} as const;

export type MemberRole = (typeof MemberRoleEnum)[keyof typeof MemberRoleEnum];

export const MemberRoleSchema = z.enum([
  MemberRoleEnum.OWNER,
  MemberRoleEnum.ADMIN,
  MemberRoleEnum.COMPLIANCE_OFFICER,
  MemberRoleEnum.MEMBER,
]);

export const MemberStatusEnum = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
} as const;

export type MemberStatus =
  (typeof MemberStatusEnum)[keyof typeof MemberStatusEnum];

export const MemberStatusSchema = z.enum([
  MemberStatusEnum.INVITED,
  MemberStatusEnum.ACTIVE,
  MemberStatusEnum.REVOKED,
]);

// ==============================================================================
// 2. Business Profile & Vendor Schemas
// ==============================================================================

export const VendorBusinessProfileSchema = z.object({
  industryCategory: z.string().min(1, "Industry category is required"),
  websiteUrl: z.string().url("Invalid website URL").optional().nullable(),
  businessEmail: z.string().email("Invalid business email"),
  businessPhone: z.string().min(5, "Business phone is required"),
  registeredAddressLine1: z.string().min(1, "Address line 1 is required"),
  registeredAddressLine2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(2, "Country is required").max(3),
  authorizedRepresentativeName: z
    .string()
    .min(1, "Representative name is required"),
  authorizedRepresentativeEmail: z
    .string()
    .email("Invalid representative email"),
  authorizedRepresentativePhone: z
    .string()
    .min(5, "Representative phone is required"),
  authorizedRepresentativeRole: z
    .string()
    .min(1, "Representative role is required"),
});

export type VendorBusinessProfile = z.infer<typeof VendorBusinessProfileSchema>;

export const CreateVendorSchema = z.object({
  legalName: z
    .string()
    .min(2, "Legal name must be at least 2 characters")
    .max(200),
  tradeName: z.string().max(200).optional().nullable(),
  organizationType: OrganizationTypeSchema,
  registrationNumber: z
    .string()
    .min(2, "Registration number is required")
    .max(100),
  taxIdentifier: z.string().min(2, "Tax identifier is required").max(100),
  country: z.string().min(2, "Country ISO code is required").max(3),
  businessProfile: VendorBusinessProfileSchema.optional().nullable(),
});

export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;

export const UpdateVendorSchema = z.object({
  legalName: z.string().min(2).max(200).optional(),
  tradeName: z.string().max(200).optional().nullable(),
  organizationType: OrganizationTypeSchema.optional(),
  registrationNumber: z.string().min(2).max(100).optional(),
  taxIdentifier: z.string().min(2).max(100).optional(),
  country: z.string().min(2).max(3).optional(),
  businessProfile: VendorBusinessProfileSchema.partial().optional().nullable(),
});

export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;

export const AttachDocumentSchema = z.object({
  documentType: DocumentTypeSchema,
  mediaFileId: z.string().min(1, "Media file ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().int().positive("File size must be positive"),
  mimeType: z.string().min(1, "MIME type is required"),
});

export type AttachDocumentInput = z.infer<typeof AttachDocumentSchema>;

export const SubmitVerificationSchema = z.object({
  workflowType: VerificationWorkflowTypeSchema.default(
    VerificationWorkflowTypeEnum.MANUAL_ADMIN,
  ),
  notes: z.string().max(1000).optional().nullable(),
});

export type SubmitVerificationInput = z.infer<typeof SubmitVerificationSchema>;

export const AdminApproveVendorSchema = z.object({
  reason: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});

export type AdminApproveVendorInput = z.infer<typeof AdminApproveVendorSchema>;

export const AdminRejectVendorSchema = z.object({
  reason: z
    .string()
    .min(3, "Rejection reason must be at least 3 characters")
    .max(1000),
  notes: z.string().max(1000).optional(),
});

export type AdminRejectVendorInput = z.infer<typeof AdminRejectVendorSchema>;

export const AdminSuspendVendorSchema = z.object({
  reason: z
    .string()
    .min(3, "Suspension reason must be at least 3 characters")
    .max(1000),
  notes: z.string().max(1000).optional(),
});

export type AdminSuspendVendorInput = z.infer<typeof AdminSuspendVendorSchema>;

export const AdminReactivateVendorSchema = z.object({
  reason: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});

export type AdminReactivateVendorInput = z.infer<
  typeof AdminReactivateVendorSchema
>;

export const AdminReviewDocumentSchema = z.object({
  status: DocumentVerificationStatusSchema,
  rejectionReason: z.string().max(1000).optional().nullable(),
});

export type AdminReviewDocumentInput = z.infer<
  typeof AdminReviewDocumentSchema
>;

// ==============================================================================
// 3. Kafka Event Topics & Payloads
// ==============================================================================

export const VENDOR_TOPICS = {
  REGISTERED: "vendor.registered",
  VERIFICATION_REQUESTED: "vendor.verification.requested",
  VERIFIED: "vendor.verified",
  REJECTED: "vendor.rejected",
  SUSPENDED: "vendor.suspended",
  REACTIVATED: "vendor.reactivated",
} as const;

export type VendorTopic = (typeof VENDOR_TOPICS)[keyof typeof VENDOR_TOPICS];

export const VendorRegisteredEventSchema = z.object({
  vendorId: z.string(),
  ownerUserId: z.string(),
  legalName: z.string(),
  tradeName: z.string().optional().nullable(),
  organizationType: z.string(),
  country: z.string(),
  status: z.string(),
  registeredAt: z.string(),
});

export type VendorRegisteredEvent = z.infer<typeof VendorRegisteredEventSchema>;

export const VendorVerificationRequestedEventSchema = z.object({
  vendorId: z.string(),
  workflowType: z.string(),
  requestedAt: z.string(),
});

export type VendorVerificationRequestedEvent = z.infer<
  typeof VendorVerificationRequestedEventSchema
>;

export const VendorVerifiedEventSchema = z.object({
  vendorId: z.string(),
  verifiedAt: z.string(),
  reviewerAdminId: z.string().optional().nullable(),
});

export type VendorVerifiedEvent = z.infer<typeof VendorVerifiedEventSchema>;

export const VendorRejectedEventSchema = z.object({
  vendorId: z.string(),
  reason: z.string(),
  rejectedAt: z.string(),
  reviewerAdminId: z.string().optional().nullable(),
});

export type VendorRejectedEvent = z.infer<typeof VendorRejectedEventSchema>;

export const VendorSuspendedEventSchema = z.object({
  vendorId: z.string(),
  reason: z.string(),
  suspendedAt: z.string(),
  adminUserId: z.string().optional().nullable(),
});

export type VendorSuspendedEvent = z.infer<typeof VendorSuspendedEventSchema>;

export const VendorReactivatedEventSchema = z.object({
  vendorId: z.string(),
  reactivatedAt: z.string(),
  adminUserId: z.string().optional().nullable(),
});

export type VendorReactivatedEvent = z.infer<
  typeof VendorReactivatedEventSchema
>;
