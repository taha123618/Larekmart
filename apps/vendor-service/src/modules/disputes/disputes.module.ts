import { Module } from "@nestjs/common";
import {
  DisputesController,
  VendorDisputesController,
  AdminDisputesController,
} from "./disputes.controller.js";
import { DisputesService } from "./disputes.service.js";
import { SettlementsModule } from "../settlements/settlements.module.js";

@Module({
  imports: [SettlementsModule],
  controllers: [
    DisputesController,
    VendorDisputesController,
    AdminDisputesController,
  ],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
