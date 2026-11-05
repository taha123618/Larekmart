import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  Inject,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { TicketsService } from "./tickets.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { IdempotencyInterceptor } from "../../common/interceptors/idempotency.interceptor.js";
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  AddTicketMessageSchema,
  TicketFilterSchema,
} from "@repo/types";

@Controller("api/v1/support/tickets")
@UseGuards(AuthGuard)
export class TicketsController {
  constructor(
    @Inject(TicketsService)
    private readonly ticketsService: TicketsService,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async createTicket(@Body() body: unknown, @Req() req: FastifyRequest) {
    const validated = CreateTicketSchema.parse(body);
    const actor = req.user!;
    const ticket = await this.ticketsService.createTicket(validated, actor);
    return {
      success: true,
      data: ticket,
    };
  }

  @Get()
  async listTickets(@Query() query: unknown, @Req() req: FastifyRequest) {
    const validated = TicketFilterSchema.parse(query);
    const actor = req.user!;
    const result = await this.ticketsService.listTickets(validated, actor);
    return {
      success: true,
      ...result,
    };
  }

  @Get(":id")
  async getTicket(@Param("id") id: string, @Req() req: FastifyRequest) {
    const actor = req.user!;
    const ticket = await this.ticketsService.getTicketById(id, actor);
    return {
      success: true,
      data: ticket,
    };
  }

  @Post(":id/messages")
  async addMessage(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const validated = AddTicketMessageSchema.parse(body);
    const actor = req.user!;
    const message = await this.ticketsService.addMessage(id, validated, actor);
    return {
      success: true,
      data: message,
    };
  }

  @Patch(":id")
  async updateTicket(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const validated = UpdateTicketSchema.parse(body);
    const actor = req.user!;
    const updated = await this.ticketsService.updateTicket(
      id,
      validated,
      actor,
    );
    return {
      success: true,
      data: updated,
    };
  }
}
