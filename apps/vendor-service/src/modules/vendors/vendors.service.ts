import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { KafkaService } from "../../kafka/kafka.service.js";
import {
  type CreateVendorInput,
  type UpdateVendorInput,
  type SubmitVerificationInput,
  CreateVendorSchema,
  UpdateVendorSchema,
  SubmitVerificationSchema,
  VENDOR_TOPICS,
  VendorStatusEnum,
  MemberRoleEnum,
  MemberStatusEnum,
} from "@repo/types";

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  async createVendor(userId: string, rawInput: CreateVendorInput) {
    const input = CreateVendorSchema.parse(rawInput);

    const existing = await this.prisma.vendor.findUnique({
      where: { registrationNumber: input.registrationNumber },
    });

    if (existing) {
      throw new ConflictException(
        `A vendor organization with registration number "${input.registrationNumber}" is already registered.`,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          legalName: input.legalName,
          tradeName: input.tradeName,
          organizationType: input.organizationType,
          registrationNumber: input.registrationNumber,
          taxIdentifier: input.taxIdentifier,
          country: input.country,
          status: VendorStatusEnum.DRAFT,
          ownerUserId: userId,
          businessProfile: input.businessProfile
            ? {
                create: {
                  industryCategory: input.businessProfile.industryCategory,
                  websiteUrl: input.businessProfile.websiteUrl,
                  businessEmail: input.businessProfile.businessEmail,
                  businessPhone: input.businessProfile.businessPhone,
                  registeredAddressLine1:
                    input.businessProfile.registeredAddressLine1,
                  registeredAddressLine2:
                    input.businessProfile.registeredAddressLine2,
                  city: input.businessProfile.city,
                  state: input.businessProfile.state,
                  postalCode: input.businessProfile.postalCode,
                  country: input.businessProfile.country,
                  authorizedRepresentativeName:
                    input.businessProfile.authorizedRepresentativeName,
                  authorizedRepresentativeEmail:
                    input.businessProfile.authorizedRepresentativeEmail,
                  authorizedRepresentativePhone:
                    input.businessProfile.authorizedRepresentativePhone,
                  authorizedRepresentativeRole:
                    input.businessProfile.authorizedRepresentativeRole,
                },
              }
            : undefined,
          members: {
            create: {
              userId,
              role: MemberRoleEnum.OWNER,
              permissions: ["*"],
              status: MemberStatusEnum.ACTIVE,
            },
          },
          statusHistory: {
            create: {
              fromStatus: VendorStatusEnum.DRAFT,
              toStatus: VendorStatusEnum.DRAFT,
              changedByUserId: userId,
              changeReason: "Initial vendor merchant registration",
            },
          },
        },
        include: {
          businessProfile: true,
          members: true,
          documents: true,
        },
      });

      return vendor;
    });

    // Publish vendor.registered event
    await this.kafka.emitEvent(VENDOR_TOPICS.REGISTERED, {
      vendorId: created.id,
      ownerUserId: created.ownerUserId,
      legalName: created.legalName,
      tradeName: created.tradeName,
      organizationType: created.organizationType,
      country: created.country,
      status: created.status,
      registeredAt: created.createdAt.toISOString(),
    });

    return created;
  }

  async getVendorById(vendorId: string) {
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

  async updateVendor(
    vendorId: string,
    userId: string,
    rawInput: UpdateVendorInput,
  ) {
    const input = UpdateVendorSchema.parse(rawInput);

    const vendor = await this.getVendorById(vendorId);

    if (vendor.status === VendorStatusEnum.TERMINATED) {
      throw new BadRequestException(
        "Terminated vendor organizations cannot be modified",
      );
    }

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(input.legalName ? { legalName: input.legalName } : {}),
        ...(input.tradeName !== undefined
          ? { tradeName: input.tradeName }
          : {}),
        ...(input.organizationType
          ? { organizationType: input.organizationType }
          : {}),
        ...(input.registrationNumber
          ? { registrationNumber: input.registrationNumber }
          : {}),
        ...(input.taxIdentifier ? { taxIdentifier: input.taxIdentifier } : {}),
        ...(input.country ? { country: input.country } : {}),
        ...(input.businessProfile
          ? {
              businessProfile: {
                upsert: {
                  create: {
                    industryCategory:
                      input.businessProfile.industryCategory || "General",
                    websiteUrl: input.businessProfile.websiteUrl,
                    businessEmail:
                      input.businessProfile.businessEmail || "info@example.com",
                    businessPhone:
                      input.businessProfile.businessPhone || "+1000000000",
                    registeredAddressLine1:
                      input.businessProfile.registeredAddressLine1 || "Address",
                    registeredAddressLine2:
                      input.businessProfile.registeredAddressLine2,
                    city: input.businessProfile.city || "City",
                    state: input.businessProfile.state || "State",
                    postalCode: input.businessProfile.postalCode || "00000",
                    country: input.businessProfile.country || vendor.country,
                    authorizedRepresentativeName:
                      input.businessProfile.authorizedRepresentativeName ||
                      "Authorized Rep",
                    authorizedRepresentativeEmail:
                      input.businessProfile.authorizedRepresentativeEmail ||
                      "rep@example.com",
                    authorizedRepresentativePhone:
                      input.businessProfile.authorizedRepresentativePhone ||
                      "+1000000000",
                    authorizedRepresentativeRole:
                      input.businessProfile.authorizedRepresentativeRole ||
                      "Representative",
                  },
                  update: {
                    ...(input.businessProfile.industryCategory
                      ? {
                          industryCategory:
                            input.businessProfile.industryCategory,
                        }
                      : {}),
                    ...(input.businessProfile.websiteUrl !== undefined
                      ? { websiteUrl: input.businessProfile.websiteUrl }
                      : {}),
                    ...(input.businessProfile.businessEmail
                      ? { businessEmail: input.businessProfile.businessEmail }
                      : {}),
                    ...(input.businessProfile.businessPhone
                      ? { businessPhone: input.businessProfile.businessPhone }
                      : {}),
                    ...(input.businessProfile.registeredAddressLine1
                      ? {
                          registeredAddressLine1:
                            input.businessProfile.registeredAddressLine1,
                        }
                      : {}),
                    ...(input.businessProfile.registeredAddressLine2 !==
                    undefined
                      ? {
                          registeredAddressLine2:
                            input.businessProfile.registeredAddressLine2,
                        }
                      : {}),
                    ...(input.businessProfile.city
                      ? { city: input.businessProfile.city }
                      : {}),
                    ...(input.businessProfile.state
                      ? { state: input.businessProfile.state }
                      : {}),
                    ...(input.businessProfile.postalCode
                      ? { postalCode: input.businessProfile.postalCode }
                      : {}),
                    ...(input.businessProfile.country
                      ? { country: input.businessProfile.country }
                      : {}),
                    ...(input.businessProfile.authorizedRepresentativeName
                      ? {
                          authorizedRepresentativeName:
                            input.businessProfile.authorizedRepresentativeName,
                        }
                      : {}),
                    ...(input.businessProfile.authorizedRepresentativeEmail
                      ? {
                          authorizedRepresentativeEmail:
                            input.businessProfile.authorizedRepresentativeEmail,
                        }
                      : {}),
                    ...(input.businessProfile.authorizedRepresentativePhone
                      ? {
                          authorizedRepresentativePhone:
                            input.businessProfile.authorizedRepresentativePhone,
                        }
                      : {}),
                    ...(input.businessProfile.authorizedRepresentativeRole
                      ? {
                          authorizedRepresentativeRole:
                            input.businessProfile.authorizedRepresentativeRole,
                        }
                      : {}),
                  },
                },
              },
            }
          : {}),
      },
      include: {
        businessProfile: true,
        documents: true,
        members: true,
      },
    });

    return updated;
  }

  async submitForVerification(
    vendorId: string,
    userId: string,
    rawInput: SubmitVerificationInput,
  ) {
    const input = SubmitVerificationSchema.parse(rawInput);
    const vendor = await this.getVendorById(vendorId);

    if (
      vendor.status !== VendorStatusEnum.DRAFT &&
      vendor.status !== VendorStatusEnum.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot submit for verification from current status: ${vendor.status}`,
      );
    }

    if (vendor.documents.length === 0) {
      throw new BadRequestException(
        "At least one business verification document must be uploaded before submitting for verification.",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: VendorStatusEnum.PENDING_VERIFICATION,
        },
      });

      const verification = await tx.vendorVerification.create({
        data: {
          vendorId,
          workflowType: input.workflowType,
          status: "INITIATED",
          reviewNotes: input.notes,
        },
      });

      await tx.vendorStatusHistory.create({
        data: {
          vendorId,
          fromStatus: vendor.status,
          toStatus: VendorStatusEnum.PENDING_VERIFICATION,
          changedByUserId: userId,
          changeReason: "Submitted for KYB verification",
          notes: input.notes,
        },
      });

      return { vendor: v, verification };
    });

    // Publish vendor.verification.requested event
    await this.kafka.emitEvent(VENDOR_TOPICS.VERIFICATION_REQUESTED, {
      vendorId,
      workflowType: input.workflowType,
      requestedAt: new Date().toISOString(),
    });

    return updated;
  }

  async getUserVendors(userId: string) {
    return this.prisma.vendor.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          {
            members: {
              some: {
                userId,
                status: MemberStatusEnum.ACTIVE,
              },
            },
          },
        ],
      },
      include: {
        businessProfile: true,
        documents: true,
        members: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
