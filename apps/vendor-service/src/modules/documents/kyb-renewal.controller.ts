import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { KybRenewalService } from "./kyb-renewal.service.js";

@Controller("api/v1/vendors/:vendorId/kyb")
export class KybRenewalController {
  constructor(private readonly kybRenewalService: KybRenewalService) {}

  @Get("expiration")
  evaluateExpiration(
    @Param("vendorId") vendorId: string,
    @Query("expiresAt") expiresAt: string,
  ) {
    return this.kybRenewalService.evaluateKybExpiration(
      vendorId,
      expiresAt || new Date(Date.now() + 90 * 86400_000).toISOString(),
    );
  }

  @Post("renewals")
  submitRenewal(
    @Param("vendorId") vendorId: string,
    @Body()
    body: {
      documentType: string;
      documentUrl: string;
      expiresAt: string;
      riskScore?: number;
    },
  ) {
    return this.kybRenewalService.submitDocumentRenewal({
      vendorId,
      documentType: body.documentType,
      documentUrl: body.documentUrl,
      expiresAt: body.expiresAt,
      riskScore: body.riskScore,
    });
  }

  @Get("renewals")
  getRenewals(@Param("vendorId") vendorId: string) {
    return { renewals: this.kybRenewalService.getVendorRenewals(vendorId) };
  }
}
