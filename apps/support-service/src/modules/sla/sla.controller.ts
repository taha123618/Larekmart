import { Controller, Get, Post, Body, UseGuards, Inject } from "@nestjs/common";
import { SlaService } from "./sla.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { AdminGuard } from "../../common/guards/admin.guard.js";

@Controller("api/v1/admin/support/sla-policies")
export class SlaController {
  constructor(
    @Inject(SlaService)
    private readonly slaService: SlaService,
  ) {}

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  async getPolicies() {
    const policies = await this.slaService.listPolicies();
    return {
      success: true,
      data: policies,
    };
  }
}
