import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import { AdminVendorsService } from "./admin-vendors.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { AdminGuard } from "../../common/guards/admin.guard.js";
import { ManageAdminGuard } from "../../common/guards/manage-admin.guard.js";
import type {
  AdminApproveVendorInput,
  AdminRejectVendorInput,
  AdminSuspendVendorInput,
  AdminReactivateVendorInput,
  AdminReviewDocumentInput,
  VendorStatus,
} from "@repo/types";

@Controller("api/v1/admin/vendors")
@UseGuards(AuthGuard, AdminGuard)
export class AdminVendorsController {
  constructor(private readonly adminVendorsService: AdminVendorsService) {}

  @Get()
  async listVendors(
    @Query("status") status?: VendorStatus,
    @Query("country") country?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminVendorsService.listVendors({
      status,
      country,
      search,
      page,
      limit,
    });
  }

  @Get(":vendorId")
  async getVendorDetails(@Param("vendorId") vendorId: string) {
    return this.adminVendorsService.getVendorDetails(vendorId);
  }

  @Post(":vendorId/approve")
  @UseGuards(ManageAdminGuard)
  @HttpCode(HttpStatus.OK)
  async approveVendor(
    @Param("vendorId") vendorId: string,
    @Headers("x-user-id") adminId: string,
    @Body() body: AdminApproveVendorInput,
  ) {
    return this.adminVendorsService.approveVendor(vendorId, adminId, body);
  }

  @Post(":vendorId/reject")
  @UseGuards(ManageAdminGuard)
  @HttpCode(HttpStatus.OK)
  async rejectVendor(
    @Param("vendorId") vendorId: string,
    @Headers("x-user-id") adminId: string,
    @Body() body: AdminRejectVendorInput,
  ) {
    return this.adminVendorsService.rejectVendor(vendorId, adminId, body);
  }

  @Post(":vendorId/suspend")
  @UseGuards(ManageAdminGuard)
  @HttpCode(HttpStatus.OK)
  async suspendVendor(
    @Param("vendorId") vendorId: string,
    @Headers("x-user-id") adminId: string,
    @Body() body: AdminSuspendVendorInput,
  ) {
    return this.adminVendorsService.suspendVendor(vendorId, adminId, body);
  }

  @Post(":vendorId/reactivate")
  @UseGuards(ManageAdminGuard)
  @HttpCode(HttpStatus.OK)
  async reactivateVendor(
    @Param("vendorId") vendorId: string,
    @Headers("x-user-id") adminId: string,
    @Body() body: AdminReactivateVendorInput,
  ) {
    return this.adminVendorsService.reactivateVendor(vendorId, adminId, body);
  }

  @Patch(":vendorId/documents/:documentId")
  @UseGuards(ManageAdminGuard)
  async reviewDocument(
    @Param("vendorId") vendorId: string,
    @Param("documentId") documentId: string,
    @Headers("x-user-id") adminId: string,
    @Body() body: AdminReviewDocumentInput,
  ) {
    return this.adminVendorsService.reviewDocument(
      vendorId,
      documentId,
      adminId,
      body,
    );
  }
}
