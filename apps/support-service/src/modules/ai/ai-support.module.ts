import { Module } from "@nestjs/common";
import { AiSupportController } from "./ai-support.controller.js";
import { AiSupportService } from "./ai-support.service.js";

@Module({
  controllers: [AiSupportController],
  providers: [AiSupportService],
  exports: [AiSupportService],
})
export class AiSupportModule {}
