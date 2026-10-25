import assert from "assert";
import {
  VendorStatusEnum,
  VendorStatusSchema,
  OrganizationTypeEnum,
  OrganizationTypeSchema,
  DocumentTypeEnum,
  DocumentTypeSchema,
  DocumentVerificationStatusEnum,
  DocumentVerificationStatusSchema,
  MemberRoleEnum,
  MemberRoleSchema,
  CreateVendorSchema,
  UpdateVendorSchema,
  AttachDocumentSchema,
  SubmitVerificationSchema,
  AdminApproveVendorSchema,
  AdminRejectVendorSchema,
  AdminSuspendVendorSchema,
  AdminReactivateVendorSchema,
  AdminReviewDocumentSchema,
  VendorRegisteredEventSchema,
  VendorVerificationRequestedEventSchema,
  VendorVerifiedEventSchema,
  VendorRejectedEventSchema,
  VendorSuspendedEventSchema,
  VendorReactivatedEventSchema,
} from "../src/index.js";

async function runVendorContractTests() {
  console.log("=== Vendor Service Domain Contracts Test Suite ===\n");

  // 1. Enums
  console.log("1. Testing Vendor Status & Enums...");
  assert.equal(VendorStatusEnum.DRAFT, "DRAFT");
  assert.equal(VendorStatusEnum.PENDING_VERIFICATION, "PENDING_VERIFICATION");
  assert.equal(VendorStatusEnum.VERIFIED, "VERIFIED");
  assert.equal(VendorStatusEnum.REJECTED, "REJECTED");
  assert.equal(VendorStatusEnum.SUSPENDED, "SUSPENDED");
  assert.equal(VendorStatusEnum.TERMINATED, "TERMINATED");
  assert.equal(VendorStatusEnum.DEACTIVATED, "DEACTIVATED");

  assert.equal(OrganizationTypeEnum.LLC, "LLC");
  assert.equal(DocumentTypeEnum.BUSINESS_REGISTRATION, "BUSINESS_REGISTRATION");
  assert.equal(DocumentVerificationStatusEnum.PENDING, "PENDING");
  assert.equal(MemberRoleEnum.OWNER, "OWNER");
  console.log("✓ Enums verified");

  // 2. CreateVendorSchema
  console.log("2. Testing CreateVendorSchema...");
  const validVendorInput = {
    legalName: "Acme Global Trading LLC",
    tradeName: "Acme Superstore",
    organizationType: "LLC",
    registrationNumber: "REG-98765",
    taxIdentifier: "US-EIN-123456789",
    country: "US",
    businessProfile: {
      industryCategory: "Retail",
      websiteUrl: "https://acme.example.com",
      businessEmail: "support@acme.example.com",
      businessPhone: "+1234567890",
      registeredAddressLine1: "100 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      authorizedRepresentativeName: "John Doe",
      authorizedRepresentativeEmail: "john@acme.example.com",
      authorizedRepresentativePhone: "+1234567890",
      authorizedRepresentativeRole: "Director",
    },
  };
  const parsedCreate = CreateVendorSchema.parse(validVendorInput);
  assert.equal(parsedCreate.legalName, "Acme Global Trading LLC");
  assert.equal(parsedCreate.tradeName, "Acme Superstore");
  assert.equal(parsedCreate.organizationType, "LLC");

  assert.throws(() => {
    CreateVendorSchema.parse({
      legalName: "A", // too short
      organizationType: "UNKNOWN",
      registrationNumber: "",
      taxIdentifier: "",
      country: "",
    });
  });
  console.log("✓ CreateVendorSchema verified");

  // 3. AttachDocumentSchema
  console.log("3. Testing AttachDocumentSchema...");
  const validDoc = {
    documentType: "BUSINESS_REGISTRATION",
    mediaFileId: "med-123456",
    fileName: "cert.pdf",
    mimeType: "application/pdf",
    fileSize: 2048500,
  };
  const parsedDoc = AttachDocumentSchema.parse(validDoc);
  assert.equal(parsedDoc.documentType, "BUSINESS_REGISTRATION");
  assert.equal(parsedDoc.mediaFileId, "med-123456");

  assert.throws(() => {
    AttachDocumentSchema.parse({
      documentType: "NOT_A_REAL_TYPE",
      mediaFileId: "",
      fileName: "",
      fileSize: -10,
      mimeType: "",
    });
  });
  console.log("✓ AttachDocumentSchema verified");

  // 4. Admin Schemas
  console.log("4. Testing Admin Schemas...");
  const approve = AdminApproveVendorSchema.parse({
    reason: "All documents valid and verified",
  });
  assert.equal(approve.reason, "All documents valid and verified");

  assert.throws(() => {
    AdminRejectVendorSchema.parse({ reason: "no" }); // min length 3
  });

  const reject = AdminRejectVendorSchema.parse({
    reason: "Expired tax registration certificate",
  });
  assert.equal(reject.reason, "Expired tax registration certificate");
  console.log("✓ Admin Schemas verified");

  // 5. Kafka Event Schemas
  console.log("5. Testing Kafka Event Schemas...");
  const registeredEvent = VendorRegisteredEventSchema.parse({
    vendorId: "vnd-123",
    ownerUserId: "user-999",
    legalName: "Acme Global Trading LLC",
    tradeName: "Acme Superstore",
    organizationType: "LLC",
    country: "US",
    status: "DRAFT",
    registeredAt: new Date().toISOString(),
  });
  assert.equal(registeredEvent.vendorId, "vnd-123");

  const verifiedEvent = VendorVerifiedEventSchema.parse({
    vendorId: "vnd-123",
    verifiedAt: new Date().toISOString(),
    reviewerAdminId: "admin-456",
  });
  assert.equal(verifiedEvent.reviewerAdminId, "admin-456");
  console.log("✓ Kafka Event Schemas verified");

  console.log("\nALL VENDOR CONTRACT TESTS PASSED! 🎉");
}

runVendorContractTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
