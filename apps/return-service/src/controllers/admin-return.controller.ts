import type { Context } from "koa";
import { adminReturnService } from "../services/admin-return.service.js";

export class AdminReturnController {
  async listReturns(ctx: Context): Promise<void> {
    const { status, sellerId, requiresManualReview, limit, offset } = ctx.query;
    const returns = await adminReturnService.listReturns(
      {
        status: status as string | undefined,
        sellerId: sellerId as string | undefined,
        requiresManualReview: requiresManualReview === "true" ? true : undefined,
      },
      Math.min(Number(limit) || 50, 200),
      Number(offset) || 0,
    );
    ctx.body = { returns };
  }

  async getReturn(ctx: Context): Promise<void> {
    const returnId = ctx.params.returnId;
    const ret = await adminReturnService.getReturnDetails(returnId);
    ctx.body = { return: ret };
  }

  async approveReturn(ctx: Context): Promise<void> {
    const reviewerId = ctx.state.userId as string;
    const reviewerRole = (ctx.state.userRole as string) || "ADMIN";
    const returnId = ctx.params.returnId;
    const body = (ctx.request.body as { providePrepaidLabel?: boolean; notes?: string }) || {};

    const result = await adminReturnService.approveReturn(
      returnId,
      reviewerId,
      reviewerRole,
      body.providePrepaidLabel !== false,
      body.notes,
    );
    ctx.body = result;
  }

  async rejectReturn(ctx: Context): Promise<void> {
    const reviewerId = ctx.state.userId as string;
    const reviewerRole = (ctx.state.userRole as string) || "ADMIN";
    const returnId = ctx.params.returnId;
    const body = (ctx.request.body as { rejectionReason: string }) || {};

    if (!body.rejectionReason) {
      ctx.status = 400;
      ctx.body = { message: "rejectionReason is required." };
      return;
    }

    const result = await adminReturnService.rejectReturn(
      returnId,
      reviewerId,
      reviewerRole,
      body.rejectionReason,
    );
    ctx.body = result;
  }

  async recordInspection(ctx: Context): Promise<void> {
    const inspectorId = ctx.state.userId as string;
    const returnId = ctx.params.returnId;
    const body = ctx.request.body as {
      overallCondition: string;
      items: Array<{
        returnItemId: string;
        receivedCondition: string;
        disposition: string;
        notes?: string;
      }>;
      notes?: string;
    };

    if (!body.overallCondition || !Array.isArray(body.items) || body.items.length === 0) {
      ctx.status = 400;
      ctx.body = { message: "overallCondition and items[] are required." };
      return;
    }

    const result = await adminReturnService.recordInspection(returnId, inspectorId, body);
    ctx.body = result;
  }

  async retryRefund(ctx: Context): Promise<void> {
    const adminId = ctx.state.userId as string;
    const returnId = ctx.params.returnId;
    const result = await adminReturnService.retryRefund(returnId, adminId);
    ctx.body = result;
  }
}

export const adminReturnController = new AdminReturnController();
