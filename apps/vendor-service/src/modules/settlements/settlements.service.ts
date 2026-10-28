import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { KafkaService } from "../../kafka/kafka.service.js";
import {
  EscrowStatus,
  PayoutStatus,
  PayoutMethod,
  type RequestPayoutInput,
  type VendorBalance as VendorBalanceDto,
  type VendorSettlementOverview,
} from "@repo/types";
import { Prisma } from "@repo/vendor-db";

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  /**
   * Authoritative balance retrieval or initialization for a vendor.
   */
  async getOrCreateBalance(vendorId: string): Promise<VendorBalanceDto> {
    let balance = await this.prisma.vendorBalance.findUnique({
      where: { vendorId },
    });

    if (!balance) {
      balance = await this.prisma.vendorBalance.create({
        data: {
          vendorId,
          currency: "PKR",
          availableBalance: new Prisma.Decimal(0),
          escrowBalance: new Prisma.Decimal(0),
          disputeFrozenBalance: new Prisma.Decimal(0),
          lifetimeEarnings: new Prisma.Decimal(0),
          lifetimePaid: new Prisma.Decimal(0),
        },
      });
    }

    return {
      vendorId: balance.vendorId,
      currency: balance.currency,
      availableBalance: balance.availableBalance.toNumber(),
      escrowBalance: balance.escrowBalance.toNumber(),
      disputeFrozenBalance: balance.disputeFrozenBalance.toNumber(),
      lifetimeEarnings: balance.lifetimeEarnings.toNumber(),
      lifetimePaid: balance.lifetimePaid.toNumber(),
      lastPayoutAt: balance.lastPayoutAt
        ? balance.lastPayoutAt.toISOString()
        : null,
      updatedAt: balance.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieve paginated escrow ledger transactions for a vendor.
   */
  async getEscrowTransactions(
    vendorId: string,
    query: { status?: EscrowStatus; page?: number; limit?: number },
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { vendorId };
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.vendorEscrowLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.vendorEscrowLedger.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        vendorId: t.vendorId,
        orderId: t.orderId,
        orderItemId: t.orderItemId,
        grossAmount: t.grossAmount.toNumber(),
        commissionRate: t.commissionRate.toNumber(),
        commissionAmount: t.commissionAmount.toNumber(),
        netAmount: t.netAmount.toNumber(),
        currency: t.currency,
        status: t.status,
        deliveredAt: t.deliveredAt ? t.deliveredAt.toISOString() : null,
        releaseDueAt: t.releaseDueAt ? t.releaseDueAt.toISOString() : null,
        releasedAt: t.releasedAt ? t.releasedAt.toISOString() : null,
        disputeReason: t.disputeReason,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve payout history for a vendor.
   */
  async getPayoutRequests(
    vendorId: string,
    query: { status?: PayoutStatus; page?: number; limit?: number },
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { vendorId };
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.vendorPayoutRequest.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.vendorPayoutRequest.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        vendorId: p.vendorId,
        payoutBatchId: p.payoutBatchId,
        amount: p.amount.toNumber(),
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        status: p.status,
        bankName: p.bankName,
        accountTitle: p.accountTitle,
        accountNumberOrIban: p.accountNumberOrIban,
        notes: p.notes,
        rejectionReason: p.rejectionReason,
        transactionReference: p.transactionReference,
        requestedAt: p.requestedAt.toISOString(),
        approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Resolves category commission rate with vendor override precedence.
   */
  async resolveCommissionRate(
    vendorId: string,
    categoryId?: string,
  ): Promise<number> {
    if (categoryId) {
      // 1. Check custom vendor override
      const vendorOverride = await this.prisma.vendorCommissionRate.findUnique({
        where: {
          vendorId_categoryId: {
            vendorId,
            categoryId,
          },
        },
      });
      if (vendorOverride) {
        return vendorOverride.ratePercentage.toNumber();
      }

      // 2. Check global category default
      const categoryDefault = await this.prisma.vendorCommissionRate.findFirst({
        where: {
          vendorId: null,
          categoryId,
        },
      });
      if (categoryDefault) {
        return categoryDefault.ratePercentage.toNumber();
      }
    }

    // Default marketplace commission: 8.00%
    return 8.0;
  }

  /**
   * Credit customer payment to merchant escrow upon order placement.
   */
  async creditOrderEscrow(payload: {
    vendorId: string;
    orderId: string;
    orderItemId?: string;
    grossAmount: number;
    categoryId?: string;
    currency?: string;
  }) {
    const { vendorId, orderId, orderItemId, grossAmount, categoryId } = payload;
    const currency = payload.currency || "PKR";

    // Idempotency check: don't double-credit the exact same item
    const existing = await this.prisma.vendorEscrowLedger.findFirst({
      where: {
        vendorId,
        orderId,
        orderItemId: orderItemId || null,
      },
    });

    if (existing) {
      this.logger.warn(
        `Escrow entry already exists for order ${orderId} item ${orderItemId}`,
      );
      return existing;
    }

    const rate = await this.resolveCommissionRate(vendorId, categoryId);
    const grossDec = new Prisma.Decimal(grossAmount);
    const rateDec = new Prisma.Decimal(rate);
    const commissionDec = grossDec
      .mul(rateDec)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const netDec = grossDec.sub(commissionDec);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Escrow Ledger record
      const ledger = await tx.vendorEscrowLedger.create({
        data: {
          vendorId,
          orderId,
          orderItemId,
          grossAmount: grossDec,
          commissionRate: rateDec,
          commissionAmount: commissionDec,
          netAmount: netDec,
          currency,
          status: "HELD_IN_ESCROW",
        },
      });

      // 2. Increment vendor escrow balance atomically
      await tx.vendorBalance.upsert({
        where: { vendorId },
        create: {
          vendorId,
          currency,
          availableBalance: new Prisma.Decimal(0),
          escrowBalance: netDec,
          disputeFrozenBalance: new Prisma.Decimal(0),
          lifetimeEarnings: new Prisma.Decimal(0),
          lifetimePaid: new Prisma.Decimal(0),
        },
        update: {
          escrowBalance: { increment: netDec },
        },
      });

      return ledger;
    });

    // 3. Emit Kafka event
    await this.kafka.emitEvent("vendor.escrow.credited", {
      eventId: `escrow_${result.id}`,
      eventType: "vendor.escrow.credited",
      vendorId,
      orderId,
      grossAmount: grossDec.toNumber(),
      commissionRate: rateDec.toNumber(),
      commissionAmount: commissionDec.toNumber(),
      netAmount: netDec.toNumber(),
      currency,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Stamp delivery timestamp and initiate 7-day return buffer window.
   */
  async recordDeliveryAndScheduleRelease(
    orderId: string,
    deliveredAt: Date = new Date(),
  ) {
    const returnWindowDays = 7;
    const releaseDueAt = new Date(
      deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000,
    );

    const updated = await this.prisma.vendorEscrowLedger.updateMany({
      where: {
        orderId,
        status: "HELD_IN_ESCROW",
      },
      data: {
        deliveredAt,
        releaseDueAt,
      },
    });

    this.logger.log(
      `Scheduled escrow release for ${updated.count} items in order ${orderId} on ${releaseDueAt.toISOString()}`,
    );

    return updated;
  }

  /**
   * Auto-release escrow items that have cleared their 7-day return buffer.
   */
  async releaseMaturedEscrow(): Promise<{
    count: number;
    releasedTotal: number;
  }> {
    const now = new Date();

    const matured = await this.prisma.vendorEscrowLedger.findMany({
      where: {
        status: "HELD_IN_ESCROW",
        releaseDueAt: {
          lte: now,
        },
      },
    });

    if (matured.length === 0) {
      return { count: 0, releasedTotal: 0 };
    }

    let releasedTotal = 0;

    for (const item of matured) {
      await this.prisma.$transaction(async (tx) => {
        // Mark as released
        await tx.vendorEscrowLedger.update({
          where: { id: item.id },
          data: {
            status: "RELEASED",
            releasedAt: now,
          },
        });

        // Debit escrow, credit available balance & lifetime earnings
        await tx.vendorBalance.update({
          where: { vendorId: item.vendorId },
          data: {
            escrowBalance: { decrement: item.netAmount },
            availableBalance: { increment: item.netAmount },
            lifetimeEarnings: { increment: item.netAmount },
          },
        });
      });

      releasedTotal += item.netAmount.toNumber();

      await this.kafka.emitEvent("vendor.escrow.released", {
        eventId: `rel_${item.id}`,
        eventType: "vendor.escrow.released",
        vendorId: item.vendorId,
        orderId: item.orderId,
        releasedAmount: item.netAmount.toNumber(),
        currency: item.currency,
        releasedAt: now.toISOString(),
      });
    }

    this.logger.log(
      `Released ${matured.length} escrow items totaling PKR ${releasedTotal.toLocaleString()}`,
    );

    return { count: matured.length, releasedTotal };
  }

  /**
   * Reverse escrow on customer return before release.
   */
  async reverseEscrowForReturn(orderId: string, reason?: string) {
    const items = await this.prisma.vendorEscrowLedger.findMany({
      where: {
        orderId,
        status: "HELD_IN_ESCROW",
      },
    });

    for (const item of items) {
      await this.prisma.$transaction(async (tx) => {
        await tx.vendorEscrowLedger.update({
          where: { id: item.id },
          data: {
            status: "REFUNDED_RETURN",
            disputeReason: reason || "Customer Return Approved",
          },
        });

        await tx.vendorBalance.update({
          where: { vendorId: item.vendorId },
          data: {
            escrowBalance: { decrement: item.netAmount },
          },
        });
      });
    }

    return items;
  }

  /**
   * On-demand payout request initiated by a verified vendor.
   */
  async requestPayout(vendorId: string, input: RequestPayoutInput) {
    const amountDec = new Prisma.Decimal(input.amount);

    // 1. Fetch vendor banking profile snapshot
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { businessProfile: true },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.vendorBalance.findUnique({
        where: { vendorId },
      });

      if (!balance || balance.availableBalance.lessThan(amountDec)) {
        throw new BadRequestException(
          `Insufficient available balance. Requested: ${amountDec.toNumber()}, Available: ${balance ? balance.availableBalance.toNumber() : 0}`,
        );
      }

      // 2. Atomically reserve funds from available balance
      await tx.vendorBalance.update({
        where: { vendorId },
        data: {
          availableBalance: { decrement: amountDec },
        },
      });

      // 3. Create Payout Request record
      const payoutReq = await tx.vendorPayoutRequest.create({
        data: {
          vendorId,
          amount: amountDec,
          currency: input.currency || "PKR",
          paymentMethod: input.paymentMethod || "BANK_TRANSFER",
          status: "PENDING_APPROVAL",
          bankName: "Habib Bank Limited (HBL)",
          accountTitle: vendor.legalName,
          accountNumberOrIban: `PK36HABB000000${vendor.registrationNumber.slice(0, 10)}`,
          notes: input.notes,
        },
      });

      return payoutReq;
    });

    await this.kafka.emitEvent("vendor.payout.requested", {
      eventId: `payout_req_${result.id}`,
      eventType: "vendor.payout.requested",
      payoutRequestId: result.id,
      vendorId,
      amount: amountDec.toNumber(),
      currency: input.currency || "PKR",
      requestedAt: result.requestedAt.toISOString(),
    });

    return result;
  }

  /**
   * Aggregates platform settlement overview metrics for admin operations.
   */
  async getPlatformSettlementOverview(): Promise<VendorSettlementOverview> {
    const balances = await this.prisma.vendorBalance.findMany();
    const pendingRequests = await this.prisma.vendorPayoutRequest.findMany({
      where: { status: "PENDING_APPROVAL" },
    });
    const frozenEscrow = await this.prisma.vendorEscrowLedger.findMany({
      where: { status: "DISPUTE_FROZEN" },
    });
    const releasedItems = await this.prisma.vendorEscrowLedger.findMany({
      where: { status: "RELEASED" },
      select: { commissionAmount: true },
    });

    const totalPlatformEscrow = balances.reduce(
      (sum, b) => sum + b.escrowBalance.toNumber(),
      0,
    );
    const totalAvailablePayoutLiabilities = balances.reduce(
      (sum, b) => sum + b.availableBalance.toNumber(),
      0,
    );
    const totalDisbursedLifetime = balances.reduce(
      (sum, b) => sum + b.lifetimePaid.toNumber(),
      0,
    );
    const totalCommissionCollectedLifetime = releasedItems.reduce(
      (sum, r) => sum + r.commissionAmount.toNumber(),
      0,
    );

    const pendingPayoutRequestsAmount = pendingRequests.reduce(
      (sum, p) => sum + p.amount.toNumber(),
      0,
    );
    const activeDisputedEscrowAmount = frozenEscrow.reduce(
      (sum, f) => sum + f.netAmount.toNumber(),
      0,
    );

    return {
      totalPlatformEscrow,
      totalAvailablePayoutLiabilities,
      totalDisbursedLifetime,
      totalCommissionCollectedLifetime,
      pendingPayoutRequestsCount: pendingRequests.length,
      pendingPayoutRequestsAmount,
      activeDisputedEscrowCount: frozenEscrow.length,
      activeDisputedEscrowAmount,
    };
  }

  /**
   * Generate scheduled weekly payout batch aggregating pending requests.
   */
  async generatePayoutBatch(
    periodStart: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    periodEnd: Date = new Date(),
  ) {
    const pending = await this.prisma.vendorPayoutRequest.findMany({
      where: {
        status: "PENDING_APPROVAL",
        payoutBatchId: null,
      },
    });

    if (pending.length === 0) {
      throw new BadRequestException(
        "No pending payout requests available for batch creation",
      );
    }

    const batchNumber = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const totalNetDec = pending.reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0),
    );

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.vendorPayoutBatch.create({
        data: {
          batchNumber,
          periodStart,
          periodEnd,
          totalGrossAmount: totalNetDec,
          totalCommissionDeducted: new Prisma.Decimal(0),
          totalNetAmount: totalNetDec,
          vendorCount: new Set(pending.map((p) => p.vendorId)).size,
          status: "PENDING_APPROVAL",
        },
      });

      await tx.vendorPayoutRequest.updateMany({
        where: { id: { in: pending.map((p) => p.id) } },
        data: { payoutBatchId: createdBatch.id },
      });

      return createdBatch;
    });

    return batch;
  }

  /**
   * Approve and execute a payout batch.
   */
  async approveAndExecuteBatch(
    batchId: string,
    adminId: string,
    transactionReference?: string,
  ) {
    const batch = await this.prisma.vendorPayoutBatch.findUnique({
      where: { id: batchId },
      include: { payoutRequests: true },
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${batchId} not found`);
    }

    const now = new Date();
    const ref =
      transactionReference ||
      `TXN-STATEBANK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark batch as PAID
      await tx.vendorPayoutBatch.update({
        where: { id: batchId },
        data: {
          status: "PAID",
          approvedByAdminId: adminId,
          executedAt: now,
        },
      });

      // 2. Mark requests as PAID and increment lifetime paid
      for (const req of batch.payoutRequests) {
        await tx.vendorPayoutRequest.update({
          where: { id: req.id },
          data: {
            status: "PAID",
            paidAt: now,
            transactionReference: ref,
          },
        });

        await tx.vendorBalance.update({
          where: { vendorId: req.vendorId },
          data: {
            lifetimePaid: { increment: req.amount },
            lastPayoutAt: now,
          },
        });
      }
    });

    // 3. Emit Kafka completion events
    for (const req of batch.payoutRequests) {
      await this.kafka.emitEvent("vendor.payout.completed", {
        eventId: `payout_done_${req.id}`,
        eventType: "vendor.payout.completed",
        payoutRequestId: req.id,
        vendorId: req.vendorId,
        amount: req.amount.toNumber(),
        currency: req.currency,
        referenceNumber: ref,
        completedAt: now.toISOString(),
      });
    }

    return {
      success: true,
      batchId,
      transactionReference: ref,
      disbursedRequestsCount: batch.payoutRequests.length,
      totalDisbursed: batch.totalNetAmount.toNumber(),
    };
  }

  /**
   * Freeze an escrow item on dispute.
   */
  async freezeEscrow(escrowId: string, reason: string) {
    const item = await this.prisma.vendorEscrowLedger.findUnique({
      where: { id: escrowId },
    });

    if (!item) {
      throw new NotFoundException(`Escrow record ${escrowId} not found`);
    }

    if (item.status === "DISPUTE_FROZEN") {
      return item;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vendorEscrowLedger.update({
        where: { id: escrowId },
        data: {
          status: "DISPUTE_FROZEN",
          disputeReason: reason,
        },
      });

      await tx.vendorBalance.update({
        where: { vendorId: item.vendorId },
        data: {
          escrowBalance: { decrement: item.netAmount },
          disputeFrozenBalance: { increment: item.netAmount },
        },
      });

      return updated;
    });
  }

  /**
   * Unfreeze an escrow item upon dispute resolution.
   */
  async unfreezeEscrow(escrowId: string) {
    const item = await this.prisma.vendorEscrowLedger.findUnique({
      where: { id: escrowId },
    });

    if (!item || item.status !== "DISPUTE_FROZEN") {
      throw new BadRequestException(
        `Escrow ${escrowId} is not in DISPUTE_FROZEN state`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vendorEscrowLedger.update({
        where: { id: escrowId },
        data: {
          status: "HELD_IN_ESCROW",
          disputeReason: null,
        },
      });

      await tx.vendorBalance.update({
        where: { vendorId: item.vendorId },
        data: {
          disputeFrozenBalance: { decrement: item.netAmount },
          escrowBalance: { increment: item.netAmount },
        },
      });

      return updated;
    });
  }

  /**
   * Claw back a dispute-frozen escrow item when resolved in buyer's favor.
   */
  async clawbackDisputedEscrow(escrowId: string, reason: string) {
    const item = await this.prisma.vendorEscrowLedger.findUnique({
      where: { id: escrowId },
    });

    if (!item || item.status !== "DISPUTE_FROZEN") {
      throw new BadRequestException(
        `Escrow ${escrowId} is not in DISPUTE_FROZEN state`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vendorEscrowLedger.update({
        where: { id: escrowId },
        data: {
          status: "REFUNDED_RETURN",
          disputeReason: reason,
        },
      });

      await tx.vendorBalance.update({
        where: { vendorId: item.vendorId },
        data: {
          disputeFrozenBalance: { decrement: item.netAmount },
        },
      });

      return updated;
    });
  }
}
