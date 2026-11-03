import { Controller, Get, Req, UseGuards, Inject } from "@nestjs/common";
import { PayoutsService } from "../payouts/payouts.service.js";
import { SellerGuard } from "../guards/auth.guard.js";

@Controller("api/v1/sellers/me")
@UseGuards(SellerGuard)
export class SellerPayoutController {
  constructor(
    @Inject(PayoutsService)
    private readonly payoutsService: PayoutsService,
  ) {}

  @Get("payouts")
  async getPayouts(@Req() req: { sellerId?: string }) {
    const sellerId = req.sellerId || "seller_default";
    const payouts = await this.payoutsService.getSellerPayouts(sellerId);
    return { sellerId, payouts };
  }

  @Get("balance")
  async getBalance(@Req() req: { sellerId?: string }) {
    const sellerId = req.sellerId || "seller_default";
    return await this.payoutsService.getSellerBalance(sellerId, "PKR");
  }

  @Get("statements")
  async getStatements(@Req() req: { sellerId?: string }) {
    const sellerId = req.sellerId || "seller_default";
    const statements = await this.payoutsService.getSellerStatements(sellerId);
    return { sellerId, statements };
  }
}
