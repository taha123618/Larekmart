import type { Context } from "koa";
import { CreateReturnRequestSchema, SubmitReturnTrackingSchema, ReturnEvidenceSchema } from "@repo/types";
import { returnService } from "../services/return.service.js";

export class CustomerReturnController {
  async createReturn(ctx: Context): Promise<void> {
    const customerId = ctx.state.userId as string;
    const orderId = ctx.params.orderId;
    const body = ctx.request.body as Record<string, unknown>;

    const parsed = CreateReturnRequestSchema.parse({
      ...body,
      orderId,
    });

    const result = await returnService.requestReturn(customerId, parsed);
    ctx.status = 201;
    ctx.body = result;
  }

  async getMyReturns(ctx: Context): Promise<void> {
    const customerId = ctx.state.userId as string;
    const limit = Math.min(Number(ctx.query.limit) || 20, 100);
    const offset = Number(ctx.query.offset) || 0;

    const returns = await returnService.getCustomerReturns(customerId, limit, offset);
    ctx.body = { returns };
  }

  async getReturnById(ctx: Context): Promise<void> {
    const customerId = ctx.state.userId as string;
    const returnId = ctx.params.returnId;

    const ret = await returnService.getReturnById(returnId, customerId);
    ctx.body = { return: ret };
  }

  async cancelReturn(ctx: Context): Promise<void> {
    const customerId = ctx.state.userId as string;
    const returnId = ctx.params.returnId;
    const body = (ctx.request.body as { reason?: string }) || {};

    const result = await returnService.cancelReturn(returnId, customerId, body.reason);
    ctx.body = result;
  }

  async attachEvidence(ctx: Context): Promise<void> {
    const customerId = ctx.state.userId as string;
    const returnId = ctx.params.returnId;
    const body = ctx.request.body as Record<string, unknown>;

    const parsed = ReturnEvidenceSchema.parse({
      ...body,
      returnId,
    });

    const result = await returnService.attachEvidence(returnId, customerId, parsed);
    ctx.status = 201;
    ctx.body = result;
  }

  async submitTracking(ctx: Context): Promise<void> {
    const customerId = ctx.state.userId as string;
    const returnId = ctx.params.returnId;
    const body = ctx.request.body as Record<string, unknown>;

    const parsed = SubmitReturnTrackingSchema.parse({
      ...body,
      returnId,
    });

    const result = await returnService.submitTracking(
      returnId,
      customerId,
      parsed.carrierName,
      parsed.trackingNumber,
    );
    ctx.body = result;
  }
}

export const customerReturnController = new CustomerReturnController();
