import {
  Controller,
  Get,
  Req,
  UseGuards,
  Inject,
  UnauthorizedException,
} from "@nestjs/common";
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
    if (!req.sellerId) {
      throw new UnauthorizedException("Seller identity required");
    }
    const sellerId = req.sellerId;
    const payouts = await this.payoutsService.getSellerPayouts(sellerId);
    return { sellerId, payouts };
  }

  @Get("balance")
  async getBalance(@Req() req: { sellerId?: string }) {
    if (!req.sellerId) {
      throw new UnauthorizedException("Seller identity required");
    }
    const sellerId = req.sellerId;
    return await this.payoutsService.getSellerBalance(sellerId, "PKR");
  }

  @Get("statements")
  async getStatements(@Req() req: { sellerId?: string }) {
    if (!req.sellerId) {
      throw new UnauthorizedException("Seller identity required");
    }
    const sellerId = req.sellerId;
    const statements = await this.payoutsService.getSellerStatements(sellerId);
    return { sellerId, statements };
  }
}
