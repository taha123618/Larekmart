import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { TicketsService } from "./tickets.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { AdminGuard } from "../../common/guards/admin.guard.js";
import { AssignTicketSchema, EscalateTicketSchema } from "@repo/types";

@Controller("api/v1/admin/support")
@UseGuards(AuthGuard, AdminGuard)
export class AdminTicketsController {
  constructor(
    @Inject(TicketsService)
    private readonly ticketsService: TicketsService,
  ) {}

  @Post("tickets/:id/assign")
  async assignTicket(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const validated = AssignTicketSchema.parse(body);
    const actor = req.user!;
    const result = await this.ticketsService.assignTicket(id, validated, actor);
    return {
      success: true,
      data: result,
    };
  }

  @Post("tickets/:id/escalate")
  async escalateTicket(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const validated = EscalateTicketSchema.parse(body);
    const actor = req.user!;
    const ticket = await this.ticketsService.escalateTicket(
      id,
      validated,
      actor,
    );
    return {
      success: true,
      data: ticket,
    };
  }

  @Get("analytics")
  async getAnalytics() {
    const analytics = await this.ticketsService.getResolutionAnalytics();
    return {
      success: true,
      data: analytics,
    };
  }
}
