import { Module } from "@nestjs/common";
import { TicketsService } from "./tickets.service.js";
import { TicketsController } from "./tickets.controller.js";
import { AdminTicketsController } from "./admin-tickets.controller.js";
import { CategoriesModule } from "../categories/categories.module.js";
import { SlaModule } from "../sla/sla.module.js";
import { SupportConsumerService } from "../../kafka/support-consumer.service.js";
import { IdempotencyInterceptor } from "../../common/interceptors/idempotency.interceptor.js";

@Module({
  imports: [CategoriesModule, SlaModule],
  controllers: [TicketsController, AdminTicketsController],
  providers: [TicketsService, SupportConsumerService, IdempotencyInterceptor],
  exports: [TicketsService],
})
export class TicketsModule {}
