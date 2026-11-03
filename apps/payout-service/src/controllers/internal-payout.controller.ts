import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { PayoutsService } from "../payouts/payouts.service.js";
import { InternalSecretGuard } from "../guards/auth.guard.js";
import {
  PayoutScheduleRequestSchema,
  PayoutReconcileRequestSchema,
} from "@repo/types";

@Controller("api/v1/internal/payouts")
@UseGuards(InternalSecretGuard)
export class InternalPayoutController {
  constructor(
    @Inject(PayoutsService)
    private readonly payoutsService: PayoutsService,
  ) {}

  @Post("schedule")
  async schedulePayouts(@Body() body: unknown) {
    const parseResult = PayoutScheduleRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: "Invalid payout schedule request",
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return await this.payoutsService.schedulePayoutBatch(parseResult.data);
  }

  @Post("reconcile")
  async reconcilePayouts(@Body() body: unknown) {
    const parseResult = PayoutReconcileRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: "Invalid payout reconcile request",
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return await this.payoutsService.reconcileBatch(parseResult.data);
  }
}
