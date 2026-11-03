import { Injectable, Logger } from "@nestjs/common";
import type {
  IPayoutProviderAdapter,
  PayoutDisbursementRequest,
  PayoutDisbursementResult,
} from "./payout-provider.interface.js";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class MockBankAdapter implements IPayoutProviderAdapter {
  private readonly logger = new Logger(MockBankAdapter.name);
  public readonly providerName = "MOCK_BANK";

  public async disburse(
    request: PayoutDisbursementRequest,
  ): Promise<PayoutDisbursementResult> {
    this.logger.log(
      `Disbursing ${request.currency} ${request.amount} to account ${request.accountNumberMasked} (${request.accountHolderName}) with idempotency ${request.idempotencyKey}`,
    );

    // Simulate instant test approval
    const providerRef = `ach_mock_${uuidv4().substring(0, 12)}`;
    return {
      success: true,
      providerReference: providerRef,
      providerStatus: "SUBMITTED",
      settledAt: new Date(),
    };
  }

  public async verifyStatus(
    providerReference: string,
  ): Promise<PayoutDisbursementResult> {
    return {
      success: true,
      providerReference,
      providerStatus: "SUCCESS",
      settledAt: new Date(),
    };
  }
}
