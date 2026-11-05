import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Inject,
} from "@nestjs/common";
import { PayoutsService } from "../payouts/payouts.service.js";
import { AdminGuard } from "../guards/auth.guard.js";

@Controller("api/v1/admin/payouts")
@UseGuards(AdminGuard)
export class AdminPayoutController {
  constructor(
    @Inject(PayoutsService)
    private readonly payoutsService: PayoutsService,
  ) {}

  @Get()
  async getPayouts() {
    const payouts = await this.payoutsService.getAllPayouts(50);
    return { total: payouts.length, payouts };
  }

  @Post(":payoutId/retry")
  async retryPayout(@Param("payoutId") payoutId: string) {
    return await this.payoutsService.retryPayout(payoutId);
  }
}
