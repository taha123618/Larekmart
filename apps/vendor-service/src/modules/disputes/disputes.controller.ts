import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { DisputesService } from "./disputes.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { AdminGuard } from "../../common/guards/admin.guard.js";
import { VendorMemberGuard } from "../../common/guards/vendor-member.guard.js";
import {
  CreateDisputeSchema,
  SubmitRebuttalSchema,
  ResolveDisputeSchema,
  type DisputeStatus,
} from "@repo/types";

// ==============================================================================
// 1. Customer & General Authenticated Disputes Controller
// ==============================================================================

@Controller("api/v1/disputes")
@UseGuards(AuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDispute(@Req() req: FastifyRequest, @Body() body: unknown) {
    const validated = CreateDisputeSchema.parse(body);
    const userId = req.user?.userId || "anonymous";
    const userEmail = req.user?.email;

    return this.disputesService.createDispute(userId, userEmail, validated);
  }

  @Get()
  async listDisputes(
    @Req() req: FastifyRequest,
    @Query("status") status?: DisputeStatus,
    @Query("orderId") orderId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const isAdmin =
      req.user?.role === "admin" || req.user?.role === "super_admin";

    // Non-admins only see their own disputes
    const buyerId = isAdmin ? undefined : req.user?.userId;

    return this.disputesService.listDisputes({
      buyerId,
      status,
      orderId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("overview")
  async getOverview(@Req() req: FastifyRequest) {
    const isAdmin =
      req.user?.role === "admin" || req.user?.role === "super_admin";
    if (!isAdmin) {
      throw new ForbiddenException("Admin privilege required for global overview");
    }
    return this.disputesService.getDisputesOverview();
  }

  @Get(":id")
  async getDispute(@Req() req: FastifyRequest, @Param("id") id: string) {
    const dispute = await this.disputesService.getDispute(id);
    const isAdmin =
      req.user?.role === "admin" || req.user?.role === "super_admin";

    // Ownership check: must be buyer, vendor, or admin
    if (!isAdmin && dispute.buyerId !== req.user?.userId) {
      // Allow vendor member check downstream or block
      if (req.headers["x-vendor-id"] !== dispute.vendorId) {
        throw new ForbiddenException("Access denied to this dispute");
      }
    }

    return dispute;
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  async cancelDispute(@Req() req: FastifyRequest, @Param("id") id: string) {
    const userId = req.user?.userId || "";
    return this.disputesService.cancelDispute(id, userId);
  }
}

// ==============================================================================
// 2. Vendor Member Portal Disputes Controller
// ==============================================================================

@Controller("api/v1/vendors/:vendorId/disputes")
@UseGuards(AuthGuard, VendorMemberGuard)
export class VendorDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  async listVendorDisputes(
    @Param("vendorId") vendorId: string,
    @Query("status") status?: DisputeStatus,
    @Query("orderId") orderId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.disputesService.listDisputes({
      vendorId,
      status,
      orderId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("overview")
  async getVendorOverview(@Param("vendorId") vendorId: string) {
    return this.disputesService.getDisputesOverview(vendorId);
  }

  @Get(":id")
  async getVendorDispute(
    @Param("vendorId") vendorId: string,
    @Param("id") id: string,
  ) {
    const dispute = await this.disputesService.getDispute(id);
    if (dispute.vendorId !== vendorId) {
      throw new ForbiddenException("This dispute does not belong to your vendor organization");
    }
    return dispute;
  }

  @Post(":id/rebuttal")
  @HttpCode(HttpStatus.OK)
  async submitRebuttal(
    @Param("vendorId") vendorId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const validated = SubmitRebuttalSchema.parse(body);
    return this.disputesService.submitRebuttal(id, vendorId, validated);
  }
}

// ==============================================================================
// 3. Platform Admin Arbitration Controller
// ==============================================================================

@Controller("api/v1/admin/disputes")
@UseGuards(AdminGuard)
export class AdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  async listAllDisputes(
    @Query("vendorId") vendorId?: string,
    @Query("buyerId") buyerId?: string,
    @Query("status") status?: DisputeStatus,
    @Query("orderId") orderId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.disputesService.listDisputes({
      vendorId,
      buyerId,
      status,
      orderId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("overview")
  async getAdminOverview(@Query("vendorId") vendorId?: string) {
    return this.disputesService.getDisputesOverview(vendorId);
  }

  @Get(":id")
  async getAdminDispute(@Param("id") id: string) {
    return this.disputesService.getDispute(id);
  }

  @Post(":id/resolve")
  @HttpCode(HttpStatus.OK)
  async resolveDispute(
    @Req() req: FastifyRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const validated = ResolveDisputeSchema.parse(body);
    const adminId = req.user?.userId || "system_admin";
    return this.disputesService.resolveDispute(id, adminId, validated);
  }
}

