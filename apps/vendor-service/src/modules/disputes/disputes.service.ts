import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { KafkaService } from "../../kafka/kafka.service.js";
import { SettlementsService } from "../settlements/settlements.service.js";
import {
  DisputeStatus,
  DisputeType,
  DisputeResolution,
  type CreateDisputeInput,
  type SubmitRebuttalInput,
  type ResolveDisputeInput,
  type DisputeResponse,
  type DisputesOverview,
} from "@repo/types";
import { Prisma } from "@repo/vendor-db";
import { randomBytes } from "node:crypto";

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly settlements: SettlementsService,
  ) {}

  private generateDisputeNumber(): string {
    const year = new Date().getFullYear();
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    return `DSP-${year}-${suffix}`;
  }

  /**
   * Create and open a new customer or chargeback dispute.
   * Automatically locates any held escrow for this order and freezes it.
   */
  async createDispute(
    buyerId: string,
    buyerEmail: string | undefined,
    input: CreateDisputeInput,
  ): Promise<DisputeResponse> {
    const { orderId, orderItemId, vendorId, type, disputedAmount, buyerClaim } =
      input;
    const currency = input.currency || "PKR";

    // 1. Check if vendor exists
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    // 2. Locate any active escrow entry for this order
    const escrow = await this.prisma.vendorEscrowLedger.findFirst({
      where: {
        vendorId,
        orderId,
        ...(orderItemId ? { orderItemId } : {}),
      },
    });

    let linkedEscrowId: string | null = null;
    if (escrow && escrow.status === "HELD_IN_ESCROW") {
      linkedEscrowId = escrow.id;
      // Automatically freeze the escrow
      await this.settlements.freezeEscrow(escrow.id, buyerClaim);
      this.logger.log(
        `Auto-froze escrow ${escrow.id} on order ${orderId} due to new dispute`,
      );
    }

    const disputeNumber = this.generateDisputeNumber();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7); // 7-day seller rebuttal window

    const amountDec = new Prisma.Decimal(disputedAmount);

    const dispute = await this.prisma.vendorDispute.create({
      data: {
        disputeNumber,
        orderId,
        orderItemId: orderItemId || null,
        vendorId,
        buyerId,
        buyerEmail: buyerEmail || null,
        escrowLedgerId: linkedEscrowId,
        stripeDisputeId: input.stripeDisputeId || null,
        type: type as any,
        status: "OPENED",
        disputedAmount: amountDec,
        currency,
        buyerClaim,
        buyerEvidenceUrls: input.buyerEvidenceUrls || [],
        sellerEvidenceUrls: [],
        rebuttalDeadline: deadline,
        timeline: {
          create: {
            action: "DISPUTE_OPENED",
            performedBy: buyerId,
            notes: `Dispute filed: ${type}. Rebuttal deadline set to ${deadline.toISOString()}`,
          },
        },
      },
      include: {
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // 3. Emit Kafka event
    await this.kafka.emitEvent("dispute.created", {
      disputeId: dispute.id,
      disputeNumber: dispute.disputeNumber,
      orderId: dispute.orderId,
      vendorId: dispute.vendorId,
      buyerId: dispute.buyerId,
      disputedAmount: amountDec.toNumber(),
      currency,
      type: dispute.type,
      timestamp: new Date().toISOString(),
    });

    return this.mapToResponse(dispute);
  }

  /**
   * Submit seller rebuttal defense and counter-evidence before the deadline.
   */
  async submitRebuttal(
    disputeId: string,
    vendorId: string,
    input: SubmitRebuttalInput,
  ): Promise<DisputeResponse> {
    const dispute = await this.prisma.vendorDispute.findUnique({
      where: { id: disputeId },
      include: { timeline: true },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    if (dispute.vendorId !== vendorId) {
      throw new ForbiddenException(
        "You do not have permission to rebut this dispute",
      );
    }

    if (
      dispute.status !== "OPENED" &&
      dispute.status !== "EVIDENCE_REQUESTED"
    ) {
      throw new BadRequestException(
        `Cannot submit rebuttal for dispute in ${dispute.status} status`,
      );
    }

    if (dispute.rebuttalDeadline && new Date() > dispute.rebuttalDeadline) {
      throw new BadRequestException(
        "Rebuttal deadline has expired. This dispute has escalated to arbitration.",
      );
    }

    const updated = await this.prisma.vendorDispute.update({
      where: { id: disputeId },
      data: {
        sellerRebuttal: input.sellerRebuttal,
        sellerEvidenceUrls: input.sellerEvidenceUrls,
        status: "EVIDENCE_SUBMITTED",
        timeline: {
          create: {
            action: "SELLER_REBUTTAL_SUBMITTED",
            performedBy: vendorId,
            notes: "Seller submitted counter-evidence and rebuttal defense.",
          },
        },
      },
      include: {
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await this.kafka.emitEvent("dispute.rebuttal_submitted", {
      disputeId: updated.id,
      disputeNumber: updated.disputeNumber,
      vendorId: updated.vendorId,
      status: updated.status,
      timestamp: new Date().toISOString(),
    });

    return this.mapToResponse(updated);
  }

  /**
   * Platform admin dispute resolution.
   * Resolves in buyer's favor (clawback/refund) or seller's favor (unfreeze escrow).
   */
  async resolveDispute(
    disputeId: string,
    adminId: string,
    input: ResolveDisputeInput,
  ): Promise<DisputeResponse> {
    const dispute = await this.prisma.vendorDispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    if (
      dispute.status === "RESOLVED_BUYER_FAVOR" ||
      dispute.status === "RESOLVED_SELLER_FAVOR" ||
      dispute.status === "CANCELLED"
    ) {
      throw new BadRequestException(
        `Dispute ${disputeId} is already resolved or cancelled`,
      );
    }

    const now = new Date();

    if (input.resolution === "BUYER_FAVOR") {
      // 1. Clawback the escrow if linked
      if (dispute.escrowLedgerId && input.clawbackEscrow !== false) {
        await this.settlements.clawbackDisputedEscrow(
          dispute.escrowLedgerId,
          input.resolutionReason,
        );
      }

      const updated = await this.prisma.vendorDispute.update({
        where: { id: disputeId },
        data: {
          status: "RESOLVED_BUYER_FAVOR",
          resolution: "BUYER_FAVOR",
          resolutionReason: input.resolutionReason,
          resolvedByAdminId: adminId,
          resolvedAt: now,
          timeline: {
            create: {
              action: "RESOLVED_BUYER_FAVOR",
              performedBy: adminId,
              notes: `Resolved in buyer's favor: ${input.resolutionReason}`,
            },
          },
        },
        include: {
          timeline: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      await this.kafka.emitEvent("dispute.resolved", {
        disputeId: updated.id,
        disputeNumber: updated.disputeNumber,
        orderId: updated.orderId,
        vendorId: updated.vendorId,
        resolution: "BUYER_FAVOR",
        resolutionReason: input.resolutionReason,
        resolvedAt: now.toISOString(),
      });

      return this.mapToResponse(updated);
    } else {
      // 2. Unfreeze escrow in seller's favor
      if (dispute.escrowLedgerId) {
        await this.settlements.unfreezeEscrow(dispute.escrowLedgerId);
      }

      const updated = await this.prisma.vendorDispute.update({
        where: { id: disputeId },
        data: {
          status: "RESOLVED_SELLER_FAVOR",
          resolution: "SELLER_FAVOR",
          resolutionReason: input.resolutionReason,
          resolvedByAdminId: adminId,
          resolvedAt: now,
          timeline: {
            create: {
              action: "RESOLVED_SELLER_FAVOR",
              performedBy: adminId,
              notes: `Resolved in seller's favor: ${input.resolutionReason}`,
            },
          },
        },
        include: {
          timeline: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      await this.kafka.emitEvent("dispute.resolved", {
        disputeId: updated.id,
        disputeNumber: updated.disputeNumber,
        orderId: updated.orderId,
        vendorId: updated.vendorId,
        resolution: "SELLER_FAVOR",
        resolutionReason: input.resolutionReason,
        resolvedAt: now.toISOString(),
      });

      return this.mapToResponse(updated);
    }
  }

  /**
   * Customer cancels/withdraws a dispute voluntarily.
   */
  async cancelDispute(
    disputeId: string,
    buyerId: string,
  ): Promise<DisputeResponse> {
    const dispute = await this.prisma.vendorDispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    if (dispute.buyerId !== buyerId) {
      throw new ForbiddenException(
        "You do not have permission to cancel this dispute",
      );
    }

    if (
      dispute.status === "RESOLVED_BUYER_FAVOR" ||
      dispute.status === "RESOLVED_SELLER_FAVOR" ||
      dispute.status === "CANCELLED"
    ) {
      throw new BadRequestException(
        `Dispute ${disputeId} is already concluded`,
      );
    }

    // Unfreeze escrow if it was frozen
    if (dispute.escrowLedgerId) {
      await this.settlements.unfreezeEscrow(dispute.escrowLedgerId);
    }

    const updated = await this.prisma.vendorDispute.update({
      where: { id: disputeId },
      data: {
        status: "CANCELLED",
        timeline: {
          create: {
            action: "DISPUTE_CANCELLED",
            performedBy: buyerId,
            notes: "Buyer voluntarily withdrew dispute claim.",
          },
        },
      },
      include: {
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return this.mapToResponse(updated);
  }

  /**
   * Retrieve a single dispute by ID with full timeline history.
   */
  async getDispute(disputeId: string): Promise<DisputeResponse> {
    const dispute = await this.prisma.vendorDispute.findUnique({
      where: { id: disputeId },
      include: {
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    return this.mapToResponse(dispute);
  }

  /**
   * List disputes with multi-tenant filtering (buyer, vendor, or admin).
   */
  async listDisputes(filters: {
    buyerId?: string;
    vendorId?: string;
    orderId?: string;
    status?: DisputeStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ disputes: DisputeResponse[]; total: number }> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.VendorDisputeWhereInput = {};

    if (filters.buyerId) where.buyerId = filters.buyerId;
    if (filters.vendorId) where.vendorId = filters.vendorId;
    if (filters.orderId) where.orderId = filters.orderId;
    if (filters.status) where.status = filters.status as any;
    if (filters.search) {
      where.OR = [
        { disputeNumber: { contains: filters.search, mode: "insensitive" } },
        { orderId: { contains: filters.search, mode: "insensitive" } },
        { buyerClaim: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [disputes, total] = await Promise.all([
      this.prisma.vendorDispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          timeline: {
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      this.prisma.vendorDispute.count({ where }),
    ]);

    return {
      disputes: disputes.map((d) => this.mapToResponse(d)),
      total,
    };
  }

  /**
   * Aggregate disputes summary overview for admin or vendor dashboards.
   */
  async getDisputesOverview(vendorId?: string): Promise<DisputesOverview> {
    const where: Prisma.VendorDisputeWhereInput = vendorId ? { vendorId } : {};

    const all = await this.prisma.vendorDispute.findMany({
      where,
      select: {
        status: true,
        disputedAmount: true,
      },
    });

    let openCount = 0;
    let underReviewCount = 0;
    let evidenceRequestedCount = 0;
    let arbitrationCount = 0;
    let resolvedCount = 0;
    let totalDisputedAmount = 0;

    for (const d of all) {
      totalDisputedAmount += d.disputedAmount.toNumber();
      switch (d.status) {
        case "OPENED":
          openCount++;
          break;
        case "UNDER_REVIEW":
          underReviewCount++;
          break;
        case "EVIDENCE_REQUESTED":
          evidenceRequestedCount++;
          break;
        case "EVIDENCE_SUBMITTED":
        case "ARBITRATION":
          arbitrationCount++;
          break;
        case "RESOLVED_BUYER_FAVOR":
        case "RESOLVED_SELLER_FAVOR":
          resolvedCount++;
          break;
      }
    }

    return {
      totalDisputes: all.length,
      openCount,
      underReviewCount,
      evidenceRequestedCount,
      arbitrationCount,
      resolvedCount,
      totalDisputedAmount,
    };
  }

  private mapToResponse(dispute: any): DisputeResponse {
    return {
      id: dispute.id,
      disputeNumber: dispute.disputeNumber,
      orderId: dispute.orderId,
      orderItemId: dispute.orderItemId,
      vendorId: dispute.vendorId,
      buyerId: dispute.buyerId,
      buyerEmail: dispute.buyerEmail,
      escrowLedgerId: dispute.escrowLedgerId,
      stripeDisputeId: dispute.stripeDisputeId,
      type: dispute.type,
      status: dispute.status,
      disputedAmount:
        dispute.disputedAmount instanceof Prisma.Decimal
          ? dispute.disputedAmount.toNumber()
          : Number(dispute.disputedAmount),
      currency: dispute.currency,
      buyerClaim: dispute.buyerClaim,
      buyerEvidenceUrls: dispute.buyerEvidenceUrls || [],
      sellerRebuttal: dispute.sellerRebuttal,
      sellerEvidenceUrls: dispute.sellerEvidenceUrls || [],
      rebuttalDeadline: dispute.rebuttalDeadline
        ? dispute.rebuttalDeadline.toISOString()
        : null,
      resolution: dispute.resolution,
      resolutionReason: dispute.resolutionReason,
      resolvedByAdminId: dispute.resolvedByAdminId,
      resolvedAt: dispute.resolvedAt ? dispute.resolvedAt.toISOString() : null,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
      timeline: dispute.timeline
        ? dispute.timeline.map((t: any) => ({
            id: t.id,
            disputeId: t.disputeId,
            action: t.action,
            performedBy: t.performedBy,
            notes: t.notes,
            createdAt: t.createdAt.toISOString(),
          }))
        : [],
    };
  }
}
