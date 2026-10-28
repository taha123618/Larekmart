import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SettlementsService } from "./settlements.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { VendorMemberGuard } from "../../common/guards/vendor-member.guard.js";
import {
  RequestPayoutSchema,
  type EscrowStatus,
  type PayoutStatus,
} from "@repo/types";

@Controller("api/v1/vendors/:vendorId/settlements")
@UseGuards(AuthGuard, VendorMemberGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get("balance")
  async getBalance(@Param("vendorId") vendorId: string) {
    return this.settlementsService.getOrCreateBalance(vendorId);
  }

  @Get("escrow")
  async getEscrowTransactions(
    @Param("vendorId") vendorId: string,
    @Query("status") status?: EscrowStatus,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.settlementsService.getEscrowTransactions(vendorId, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("payouts")
  async getPayoutRequests(
    @Param("vendorId") vendorId: string,
    @Query("status") status?: PayoutStatus,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.settlementsService.getPayoutRequests(vendorId, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post("payouts/request")
  @HttpCode(HttpStatus.CREATED)
  async requestPayout(
    @Param("vendorId") vendorId: string,
    @Body() body: unknown,
  ) {
    const validated = RequestPayoutSchema.parse(body);
    return this.settlementsService.requestPayout(vendorId, validated);
  }
}
