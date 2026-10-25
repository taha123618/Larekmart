import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import { VendorsService } from "./vendors.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { VendorMemberGuard } from "../../common/guards/vendor-member.guard.js";
import type {
  CreateVendorInput,
  UpdateVendorInput,
  SubmitVerificationInput,
} from "@repo/types";

@Controller("api/v1/vendors")
@UseGuards(AuthGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createVendor(
    @Headers("x-user-id") userId: string,
    @Body() body: CreateVendorInput,
  ) {
    return this.vendorsService.createVendor(userId, body);
  }

  @Get("user/me")
  async getMyVendors(@Headers("x-user-id") userId: string) {
    return this.vendorsService.getUserVendors(userId);
  }

  @Get(":vendorId")
  @UseGuards(VendorMemberGuard)
  async getVendorById(@Param("vendorId") vendorId: string) {
    return this.vendorsService.getVendorById(vendorId);
  }

  @Patch(":vendorId")
  @UseGuards(VendorMemberGuard)
  async updateVendor(
    @Param("vendorId") vendorId: string,
    @Headers("x-user-id") userId: string,
    @Body() body: UpdateVendorInput,
  ) {
    return this.vendorsService.updateVendor(vendorId, userId, body);
  }

  @Post(":vendorId/submit-verification")
  @UseGuards(VendorMemberGuard)
  @HttpCode(HttpStatus.OK)
  async submitForVerification(
    @Param("vendorId") vendorId: string,
    @Headers("x-user-id") userId: string,
    @Body() body: SubmitVerificationInput,
  ) {
    return this.vendorsService.submitForVerification(vendorId, userId, body);
  }
}
