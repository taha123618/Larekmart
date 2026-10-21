-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."OrganizationType" AS ENUM ('CORPORATION', 'LLC', 'PARTNERSHIP', 'SOLE_PROPRIETORSHIP');

-- CreateEnum
CREATE TYPE "public"."VendorStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'TERMINATED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('BUSINESS_REGISTRATION', 'TAX_CERTIFICATE', 'PROOF_OF_ADDRESS', 'ARTICLES_OF_INCORPORATION', 'DIRECTOR_ID', 'BANK_STATEMENT');

-- CreateEnum
CREATE TYPE "public"."DocumentVerificationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."VerificationWorkflowType" AS ENUM ('MANUAL_ADMIN', 'AUTOMATED_KYB', 'EXTERNAL_PROVIDER');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('INITIATED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."MemberRole" AS ENUM ('OWNER', 'ADMIN', 'COMPLIANCE_OFFICER', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "public"."vendors" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "organizationType" "public"."OrganizationType" NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "taxIdentifier" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" "public"."VendorStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_business_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "industryCategory" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "businessEmail" TEXT NOT NULL,
    "businessPhone" TEXT NOT NULL,
    "registeredAddressLine1" TEXT NOT NULL,
    "registeredAddressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "authorizedRepresentativeName" TEXT NOT NULL,
    "authorizedRepresentativeEmail" TEXT NOT NULL,
    "authorizedRepresentativePhone" TEXT NOT NULL,
    "authorizedRepresentativeRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_documents" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "documentType" "public"."DocumentType" NOT NULL,
    "mediaFileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "verificationStatus" "public"."DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_verifications" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "workflowType" "public"."VerificationWorkflowType" NOT NULL DEFAULT 'MANUAL_ADMIN',
    "status" "public"."VerificationStatus" NOT NULL DEFAULT 'INITIATED',
    "reviewedByAdminId" TEXT,
    "reviewNotes" TEXT,
    "verificationScores" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "vendor_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_members" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."MemberRole" NOT NULL DEFAULT 'MEMBER',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "public"."MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_status_history" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "fromStatus" "public"."VendorStatus" NOT NULL,
    "toStatus" "public"."VendorStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_registrationNumber_key" ON "public"."vendors"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_business_profiles_vendorId_key" ON "public"."vendor_business_profiles"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_members_vendorId_userId_key" ON "public"."vendor_members"("vendorId", "userId");

-- AddForeignKey
ALTER TABLE "public"."vendor_business_profiles" ADD CONSTRAINT "vendor_business_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_documents" ADD CONSTRAINT "vendor_documents_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_verifications" ADD CONSTRAINT "vendor_verifications_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_members" ADD CONSTRAINT "vendor_members_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_status_history" ADD CONSTRAINT "vendor_status_history_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

