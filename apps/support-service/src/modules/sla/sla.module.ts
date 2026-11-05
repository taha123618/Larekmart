import { Module } from "@nestjs/common";
import { SlaService } from "./sla.service.js";
import { SlaController } from "./sla.controller.js";

@Module({
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
