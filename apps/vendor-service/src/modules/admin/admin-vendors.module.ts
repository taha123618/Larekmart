import { Module } from "@nestjs/common";
import { AdminVendorsController } from "./admin-vendors.controller.js";
import { AdminVendorsService } from "./admin-vendors.service.js";

@Module({
  controllers: [AdminVendorsController],
  providers: [AdminVendorsService],
  exports: [AdminVendorsService],
})
export class AdminVendorsModule {}
