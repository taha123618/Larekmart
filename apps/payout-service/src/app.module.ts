import { Module } from "@nestjs/common";
import { LedgerService } from "./ledger/ledger.service.js";
import { MockBankAdapter } from "./providers/mock-bank-adapter.js";
import { PayoutProducerService } from "./kafka/payout-producer.service.js";
import { PayoutConsumerService } from "./kafka/payout-consumer.service.js";
import { PayoutsService } from "./payouts/payouts.service.js";
import { SellerPayoutController } from "./controllers/seller-payout.controller.js";
import { InternalPayoutController } from "./controllers/internal-payout.controller.js";
import { AdminPayoutController } from "./controllers/admin-payout.controller.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [],
  controllers: [
    HealthController,
    SellerPayoutController,
    InternalPayoutController,
    AdminPayoutController,
  ],
  providers: [
    LedgerService,
    MockBankAdapter,
    PayoutProducerService,
    PayoutConsumerService,
    PayoutsService,
  ],
  exports: [LedgerService, PayoutsService],
})
export class AppModule {}
