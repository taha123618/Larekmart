import { Module } from "@nestjs/common";
import { SettlementsService } from "./settlements.service.js";
import { SettlementsController } from "./settlements.controller.js";
import { AdminSettlementsController } from "./admin-settlements.controller.js";
import { SettlementsConsumer } from "./settlements.consumer.js";

@Module({
  controllers: [SettlementsController, AdminSettlementsController],
  providers: [SettlementsService, SettlementsConsumer],
  exports: [SettlementsService],
})
export class SettlementsModule {}
