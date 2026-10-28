import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SettlementsService } from "./settlements.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { AdminGuard } from "../../common/guards/admin.guard.js";
import { PrismaService } from "../../database/prisma.service.js";

@Controller("api/v1/admin/settlements")
@UseGuards(AuthGuard, AdminGuard)
export class AdminSettlementsController {
  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("overview")
  async getOverview() {
    return this.settlementsService.getPlatformSettlementOverview();
  }

  @Get("batches")
  async listBatches() {
    const batches = await this.prisma.vendorPayoutBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { payoutRequests: true },
        },
      },
    });

    return {
      batches: batches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        periodStart: b.periodStart.toISOString(),
        periodEnd: b.periodEnd.toISOString(),
        totalGrossAmount: b.totalGrossAmount.toNumber(),
        totalCommissionDeducted: b.totalCommissionDeducted.toNumber(),
        totalNetAmount: b.totalNetAmount.toNumber(),
        vendorCount: b.vendorCount,
        requestCount: b._count.payoutRequests,
        status: b.status,
        approvedByAdminId: b.approvedByAdminId,
        executedAt: b.executedAt ? b.executedAt.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  @Post("batches/generate")
  @HttpCode(HttpStatus.CREATED)
  async generateBatch() {
    return this.settlementsService.generatePayoutBatch();
  }

  @Post("batches/:batchId/approve")
  async approveBatch(
    @Param("batchId") batchId: string,
    @Headers("x-user-id") adminId: string,
    @Body() body?: { transactionReference?: string },
  ) {
    return this.settlementsService.approveAndExecuteBatch(
      batchId,
      adminId || "admin",
      body?.transactionReference,
    );
  }

  @Post("escrow/:escrowId/freeze")
  async freezeEscrow(
    @Param("escrowId") escrowId: string,
    @Body("reason") reason: string,
  ) {
    return this.settlementsService.freezeEscrow(
      escrowId,
      reason || "Administrative review hold",
    );
  }

  @Post("escrow/:escrowId/unfreeze")
  async unfreezeEscrow(@Param("escrowId") escrowId: string) {
    return this.settlementsService.unfreezeEscrow(escrowId);
  }

  @Post("escrow/sweep-matured")
  async sweepMatured() {
    return this.settlementsService.releaseMaturedEscrow();
  }
}
