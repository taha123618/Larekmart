import { prisma } from "./client.js";
import {
  OrganizationType,
  VendorStatus,
  DocumentType,
  DocumentVerificationStatus,
  VerificationWorkflowType,
  VerificationStatus,
} from "../generated/prisma/index.js";

export async function seedVendors(): Promise<void> {
  console.log("Seeding vendors into larekmart_vendor_db...");

  const vendors = [
    {
      id: "vendor_marketplace_42",
      legalName: "Apex Retail Group Ltd",
      tradeName: "Apex Outfitter",
      organizationType: OrganizationType.LLC,
      registrationNumber: "REG-PK-2024-8831",
      taxIdentifier: "NTN-8831924-1",
      country: "PAK",
      status: VendorStatus.VERIFIED,
      ownerUserId: "user_seller_apex_01",
      profile: {
        industryCategory: "Apparel & Outdoor Gear",
        websiteUrl: "https://apexoutfitter.example.com",
        businessEmail: "support@apexoutfitter.example.com",
        businessPhone: "+92-300-1234567",
        registeredAddressLine1: "Suite 401, Tech Tower, Shahrah-e-Faisal",
        city: "Karachi",
        state: "Sindh",
        postalCode: "75400",
        country: "PAK",
        authorizedRepresentativeName: "Tariq Mahmood",
        authorizedRepresentativeEmail: "tariq@apexoutfitter.example.com",
        authorizedRepresentativePhone: "+92-300-1234567",
        authorizedRepresentativeRole: "Managing Director",
      },
      documents: [
        {
          id: "doc_apex_reg_01",
          documentType: DocumentType.BUSINESS_REGISTRATION,
          mediaFileId: "media_doc_apex_reg_01",
          fileName: "Apex_Business_Registration.pdf",
          fileSize: 245000,
          mimeType: "application/pdf",
          uploadedByUserId: "user_seller_apex_01",
          verificationStatus: DocumentVerificationStatus.ACCEPTED,
        },
        {
          id: "doc_apex_tax_02",
          documentType: DocumentType.TAX_CERTIFICATE,
          mediaFileId: "media_doc_apex_tax_02",
          fileName: "Apex_Tax_Certificate.pdf",
          fileSize: 182000,
          mimeType: "application/pdf",
          uploadedByUserId: "user_seller_apex_01",
          verificationStatus: DocumentVerificationStatus.ACCEPTED,
        },
      ],
    },
    {
      id: "vendor_test_901",
      legalName: "Urban Threads Apparel Co.",
      tradeName: "Urban Threads",
      organizationType: OrganizationType.CORPORATION,
      registrationNumber: "REG-US-2023-4910",
      taxIdentifier: "EIN-49-1029481",
      country: "USA",
      status: VendorStatus.VERIFIED,
      ownerUserId: "user_seller_urban_02",
      profile: {
        industryCategory: "Streetwear & Urban Fashion",
        websiteUrl: "https://urbanthreads.example.com",
        businessEmail: "hello@urbanthreads.example.com",
        businessPhone: "+1-800-555-0199",
        registeredAddressLine1: "742 Evergreen Terrace, Suite 100",
        city: "Springfield",
        state: "Oregon",
        postalCode: "97477",
        country: "USA",
        authorizedRepresentativeName: "Sarah Connor",
        authorizedRepresentativeEmail: "sarah@urbanthreads.example.com",
        authorizedRepresentativePhone: "+1-800-555-0199",
        authorizedRepresentativeRole: "Chief Executive Officer",
      },
      documents: [
        {
          id: "doc_urban_reg_01",
          documentType: DocumentType.BUSINESS_REGISTRATION,
          mediaFileId: "media_doc_urban_reg_01",
          fileName: "UrbanThreads_Inc.pdf",
          fileSize: 310000,
          mimeType: "application/pdf",
          uploadedByUserId: "user_seller_urban_02",
          verificationStatus: DocumentVerificationStatus.ACCEPTED,
        },
      ],
    },
  ];

  for (const v of vendors) {
    const existing = await prisma.vendor.findUnique({ where: { id: v.id } });
    if (!existing) {
      await prisma.vendor.create({
        data: {
          id: v.id,
          legalName: v.legalName,
          tradeName: v.tradeName,
          organizationType: v.organizationType,
          registrationNumber: v.registrationNumber,
          taxIdentifier: v.taxIdentifier,
          country: v.country,
          status: v.status,
          ownerUserId: v.ownerUserId,
          businessProfile: {
            create: v.profile,
          },
          documents: {
            create: v.documents,
          },
          verifications: {
            create: {
              workflowType: VerificationWorkflowType.MANUAL_ADMIN,
              status: VerificationStatus.APPROVED,
              reviewedByAdminId: "admin_super_user",
              reviewNotes: "Initial verified vendor onboarding.",
              decidedAt: new Date(),
            },
          },
        },
      });
      console.log(`  ✓ Seeded vendor: ${v.legalName} (${v.id})`);
    } else {
      console.log(`  ℹ Vendor already exists: ${v.legalName} (${v.id})`);
    }
  }

  console.log("Vendor seeding completed successfully.");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedVendors()
    .catch((err) => {
      console.error("Vendor seed failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
