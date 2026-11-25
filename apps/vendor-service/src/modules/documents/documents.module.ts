import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";
import { KybRenewalController } from "./kyb-renewal.controller.js";
import { KybRenewalService } from "./kyb-renewal.service.js";

@Module({
  controllers: [DocumentsController, KybRenewalController],
  providers: [DocumentsService, KybRenewalService],
  exports: [DocumentsService, KybRenewalService],
})
export class DocumentsModule {}
