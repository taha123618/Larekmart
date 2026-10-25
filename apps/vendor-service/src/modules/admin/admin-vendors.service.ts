import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { KafkaService } from "../../kafka/kafka.service.js";
import {
  type AdminApproveVendorInput,
  type AdminRejectVendorInput,
  type AdminSuspendVendorInput,
  type AdminReactivateVendorInput,
  type AdminReviewDocumentInput,
  AdminApproveVendorSchema,
  AdminRejectVendorSchema,
  AdminSuspendVendorSchema,
  AdminReactivateVendorSchema,
  AdminReviewDocumentSchema,
  VENDOR_TOPICS,
  VendorStatusEnum,
  DocumentVerificationStatusEnum,
  VerificationStatusEnum,
  type VendorStatus,
} from "@repo/types";

@Injectable()
export class AdminVendorsService {
  private readonly logger = new Logger(AdminVendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  async listVendors(query: {
    status?: VendorStatus;
    country?: string;
    search?: string;
    page?: string | number;
    limit?: string | number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.country) {
      where.country = query.country;
    }

    if (query.search) {
      where.OR = [
        { legalName: { contains: query.search, mode: "insensitive" } },
        { tradeName: { contains: query.search, mode: "insensitive" } },
        { registrationNumber: { contains: query.search, mode: "insensitive" } },
        { taxIdentifier: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        include: {
          businessProfile: true,
          documents: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getVendorDetails(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        businessProfile: true,
        documents: true,
        verifications: {
          orderBy: { submittedAt: "desc" },
        },
        members: true,
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with id ${vendorId} not found`);
    }

    return vendor;
  }

  async approveVendor(
    vendorId: string,
    adminId: string,
    rawInput: AdminApproveVendorInput,
  ) {
    const input = AdminApproveVendorSchema.parse(rawInput || {});
    const vendor = await this.getVendorDetails(vendorId);

    if (
      vendor.status !== VendorStatusEnum.PENDING_VERIFICATION &&
      vendor.status !== VendorStatusEnum.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot approve vendor currently in ${vendor.status} status`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: VendorStatusEnum.VERIFIED,
        },
        include: {
          businessProfile: true,
          documents: true,
        },
      });

      // Update latest verification if exists
      const latestVerification = vendor.verifications[0];
      if (latestVerification) {
        await tx.vendorVerification.update({
          where: { id: latestVerification.id },
          data: {
            status: VerificationStatusEnum.APPROVED,
            reviewedByAdminId: adminId,
            reviewNotes:
              input.notes || input.reason || "Approved by administrator",
            decidedAt: new Date(),
          },
        });
      }

      // Mark pending documents as accepted
      await tx.vendorDocument.updateMany({
        where: {
          vendorId,
          verificationStatus: DocumentVerificationStatusEnum.PENDING,
        },
        data: {
          verificationStatus: DocumentVerificationStatusEnum.ACCEPTED,
        },
      });

      // Status history
      await tx.vendorStatusHistory.create({
        data: {
          vendorId,
          fromStatus: vendor.status,
          toStatus: VendorStatusEnum.VERIFIED,
          changedByUserId: adminId,
          changeReason:
            input.reason || "Administrative compliance verification approval",
          notes: input.notes,
        },
      });

      return v;
    });

    // Publish vendor.verified event
    await this.kafka.emitEvent(VENDOR_TOPICS.VERIFIED, {
      vendorId,
      verifiedAt: new Date().toISOString(),
      reviewerAdminId: adminId,
    });

    return updated;
  }

  async rejectVendor(
    vendorId: string,
    adminId: string,
    rawInput: AdminRejectVendorInput,
  ) {
    const input = AdminRejectVendorSchema.parse(rawInput);
    const vendor = await this.getVendorDetails(vendorId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: VendorStatusEnum.REJECTED,
        },
        include: {
          businessProfile: true,
          documents: true,
        },
      });

      const latestVerification = vendor.verifications[0];
      if (latestVerification) {
        await tx.vendorVerification.update({
          where: { id: latestVerification.id },
          data: {
            status: VerificationStatusEnum.REJECTED,
            reviewedByAdminId: adminId,
            reviewNotes: input.reason,
            decidedAt: new Date(),
          },
        });
      }

      await tx.vendorStatusHistory.create({
        data: {
          vendorId,
          fromStatus: vendor.status,
          toStatus: VendorStatusEnum.REJECTED,
          changedByUserId: adminId,
          changeReason: input.reason,
          notes: input.notes,
        },
      });

      return v;
    });

    // Publish vendor.rejected event
    await this.kafka.emitEvent(VENDOR_TOPICS.REJECTED, {
      vendorId,
      reason: input.reason,
      rejectedAt: new Date().toISOString(),
      reviewerAdminId: adminId,
    });

    return updated;
  }

  async suspendVendor(
    vendorId: string,
    adminId: string,
    rawInput: AdminSuspendVendorInput,
  ) {
    const input = AdminSuspendVendorSchema.parse(rawInput);
    const vendor = await this.getVendorDetails(vendorId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: VendorStatusEnum.SUSPENDED,
        },
        include: {
          businessProfile: true,
          documents: true,
        },
      });

      await tx.vendorStatusHistory.create({
        data: {
          vendorId,
          fromStatus: vendor.status,
          toStatus: VendorStatusEnum.SUSPENDED,
          changedByUserId: adminId,
          changeReason: input.reason,
          notes: input.notes,
        },
      });

      return v;
    });

    // Publish vendor.suspended event
    await this.kafka.emitEvent(VENDOR_TOPICS.SUSPENDED, {
      vendorId,
      reason: input.reason,
      suspendedAt: new Date().toISOString(),
      adminUserId: adminId,
    });

    return updated;
  }

  async reactivateVendor(
    vendorId: string,
    adminId: string,
    rawInput: AdminReactivateVendorInput,
  ) {
    const input = AdminReactivateVendorSchema.parse(rawInput || {});
    const vendor = await this.getVendorDetails(vendorId);

    if (vendor.status !== VendorStatusEnum.SUSPENDED) {
      throw new BadRequestException(
        `Only suspended vendors can be reactivated. Current status is ${vendor.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: VendorStatusEnum.VERIFIED,
        },
        include: {
          businessProfile: true,
          documents: true,
        },
      });

      await tx.vendorStatusHistory.create({
        data: {
          vendorId,
          fromStatus: vendor.status,
          toStatus: VendorStatusEnum.VERIFIED,
          changedByUserId: adminId,
          changeReason: input.reason || "Reactivated by administrator",
          notes: input.notes,
        },
      });

      return v;
    });

    // Publish vendor.reactivated event
    await this.kafka.emitEvent(VENDOR_TOPICS.REACTIVATED, {
      vendorId,
      reactivatedAt: new Date().toISOString(),
      adminUserId: adminId,
    });

    return updated;
  }

  async reviewDocument(
    vendorId: string,
    documentId: string,
    adminId: string,
    rawInput: AdminReviewDocumentInput,
  ) {
    const input = AdminReviewDocumentSchema.parse(rawInput);

    const doc = await this.prisma.vendorDocument.findFirst({
      where: { id: documentId, vendorId },
    });

    if (!doc) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    const updated = await this.prisma.vendorDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: input.status,
        rejectionReason: input.rejectionReason,
      },
    });

    return updated;
  }
}
