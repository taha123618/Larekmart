import assert from "assert";
import {
  SellerStatusEnum,
  StorefrontStatusEnum,
  StaffRoleEnum,
  StaffStatusEnum,
  PolicyTypeEnum,
  CreateSellerSchema,
  UpdateSellerSchema,
  UpdateStorefrontSchema,
  AddStaffSchema,
  UpdateSellerSettingsSchema,
  UpsertPolicySchema,
  SellerCreatedEventSchema,
  SellerActivatedEventSchema,
  SellerUpdatedEventSchema,
  SellerSuspendedEventSchema,
  SellerStorefrontUpdatedEventSchema,
  SystemSettingsSchema,
  UpdateSystemSettingsSchema,
  AdminDelegationEventSchema,
  SELLER_TOPICS,
} from "../src/index.js";

async function runSellerContractTests() {
  console.log("=== Seller Service Domain Contracts Test Suite ===\n");

  // 1. Enums
  console.log("1. Testing Seller Enums...");
  assert.equal(SellerStatusEnum.ONBOARDING, "ONBOARDING");
  assert.equal(SellerStatusEnum.ACTIVE, "ACTIVE");
  assert.equal(SellerStatusEnum.SUSPENDED, "SUSPENDED");
  assert.equal(SellerStatusEnum.INACTIVE, "INACTIVE");

  assert.equal(StorefrontStatusEnum.ACTIVE, "ACTIVE");
  assert.equal(StorefrontStatusEnum.VACATION, "VACATION");
  assert.equal(StorefrontStatusEnum.MAINTENANCE, "MAINTENANCE");
  assert.equal(StorefrontStatusEnum.CLOSED, "CLOSED");

  assert.equal(StaffRoleEnum.OWNER, "OWNER");
  assert.equal(StaffRoleEnum.MANAGER, "MANAGER");
  assert.equal(StaffRoleEnum.CATALOG_SPECIALIST, "CATALOG_SPECIALIST");

  assert.equal(PolicyTypeEnum.RETURNS, "RETURNS");
  assert.equal(PolicyTypeEnum.SHIPPING, "SHIPPING");
  assert.equal(PolicyTypeEnum.PRIVACY, "PRIVACY");
  console.log("✓ Enums verified");

  // 2. CreateSellerSchema
  console.log("2. Testing CreateSellerSchema...");
  const validCreate = {
    vendorId: "vnd-123456",
    storeName: "Apex Electronics",
    slug: "apex-electronics",
    tagline: "Best tech gadgets",
    description: "Authorized electronics and smart gadgets reseller.",
  };
  const parsedCreate = CreateSellerSchema.parse(validCreate);
  assert.equal(parsedCreate.storeName, "Apex Electronics");
  assert.equal(parsedCreate.slug, "apex-electronics");
  assert.equal(parsedCreate.vendorId, "vnd-123456");

  assert.throws(() => {
    CreateSellerSchema.parse({
      vendorId: "",
      storeName: "A", // too short
      slug: "INVALID SLUG WITH SPACES",
    });
  });
  console.log("✓ CreateSellerSchema verified");

  // 3. UpdateStorefrontSchema
  console.log("3. Testing UpdateStorefrontSchema...");
  const validStorefront = {
    name: "Apex Electronics Global",
    headline: "Leading electronics merchant",
    vacationMode: true,
    vacationMessage: "Returning next Monday",
  };
  const parsedStorefront = UpdateStorefrontSchema.parse(validStorefront);
  assert.equal(parsedStorefront.vacationMode, true);
  assert.equal(parsedStorefront.name, "Apex Electronics Global");
  console.log("✓ UpdateStorefrontSchema verified");

  // 4. AddStaffSchema & Policies
  console.log("4. Testing AddStaffSchema and UpsertPolicySchema...");
  const staff = AddStaffSchema.parse({
    userId: "user-789",
    name: "Jane Smith",
    email: "jane@apex.example.com",
    role: "MANAGER",
    permissions: ["orders:manage", "catalog:edit"],
  });
  assert.equal(staff.email, "jane@apex.example.com");
  assert.equal(staff.permissions.length, 2);

  const policy = UpsertPolicySchema.parse({
    policyType: "RETURNS",
    title: "Standard 30-Day Hassle Free Returns",
    content:
      "Items can be returned within 30 days of receipt in original condition.",
  });
  assert.equal(policy.policyType, "RETURNS");
  console.log("✓ AddStaffSchema and UpsertPolicySchema verified");

  // 5. Kafka Event Topics & Schemas
  console.log("5. Testing Kafka Topics & Schemas...");
  assert.equal(SELLER_TOPICS.CREATED, "seller.created");
  assert.equal(SELLER_TOPICS.ACTIVATED, "seller.activated");
  assert.equal(SELLER_TOPICS.STOREFRONT_UPDATED, "seller.storefront.updated");
  assert.equal(SELLER_TOPICS.SETTINGS_UPDATED, "marketplace.settings.updated");
  assert.equal(SELLER_TOPICS.DELEGATION_GRANTED, "admin.delegation.granted");
  assert.equal(SELLER_TOPICS.DELEGATION_REVOKED, "admin.delegation.revoked");

  const createdEvent = SellerCreatedEventSchema.parse({
    sellerId: "sel-001",
    vendorId: "vnd-123456",
    primaryUserId: "user-100",
    storeName: "Apex Electronics",
    slug: "apex-electronics",
    status: "ONBOARDING",
    createdAt: new Date().toISOString(),
  });
  assert.equal(createdEvent.sellerId, "sel-001");

  const activatedEvent = SellerActivatedEventSchema.parse({
    sellerId: "sel-001",
    vendorId: "vnd-123456",
    userId: "user-100",
    isSeller: true,
    activatedAt: new Date().toISOString(),
    activatedByUserId: "admin-root",
  });
  assert.equal(activatedEvent.isSeller, true);
  assert.equal(activatedEvent.userId, "user-100");

  const suspendedEvent = SellerSuspendedEventSchema.parse({
    sellerId: "sel-001",
    vendorId: "vnd-123456",
    userId: "user-100",
    isSeller: false,
    reason: "Compliance policy violation",
    suspendedAt: new Date().toISOString(),
    suspendedByUserId: "admin-root",
  });
  assert.equal(suspendedEvent.isSeller, false);
  assert.equal(suspendedEvent.reason, "Compliance policy violation");

  const storefrontEvent = SellerStorefrontUpdatedEventSchema.parse({
    sellerId: "sel-001",
    storeId: "str-001",
    storeName: "Apex Electronics",
    slug: "apex-electronics",
    vacationMode: false,
    status: "ACTIVE",
    updatedAt: new Date().toISOString(),
  });
  assert.equal(storefrontEvent.storeId, "str-001");
  console.log("✓ Kafka Topics & Event Schemas verified");

  // 6. System Settings & Delegations
  console.log("6. Testing System Settings & Delegation Schemas...");
  const settings = SystemSettingsSchema.parse({
    id: "marketplace",
    isSellerEnabled: true,
    isSellerRegistrationOpen: true,
    isStorefrontsActive: true,
    maintenanceMessage: "Marketplace maintenance",
    updatedAt: new Date().toISOString(),
    updatedBy: "super-admin-1",
  });
  assert.equal(settings.isSellerRegistrationOpen, true);
  assert.equal(settings.isStorefrontsActive, true);

  const partialUpdate = UpdateSystemSettingsSchema.parse({
    isSellerRegistrationOpen: false,
  });
  assert.equal(partialUpdate.isSellerRegistrationOpen, false);

  const delegationEvent = AdminDelegationEventSchema.parse({
    delegationId: "del-123",
    adminUserId: "admin-user-456",
    permission: "manage_sellers",
    grantedByUserId: "super-admin-1",
    action: "GRANTED",
    timestamp: new Date().toISOString(),
  });
  assert.equal(delegationEvent.action, "GRANTED");
  console.log("✓ System Settings & Delegation Schemas verified");

  console.log("\nALL SELLER CONTRACT TESTS PASSED! 🎉");
}

runSellerContractTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
