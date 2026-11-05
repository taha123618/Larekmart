export interface PayoutDisbursementRequest {
  payoutId: string;
  payoutNumber: string;
  sellerId: string;
  amount: number;
  currency: string;
  accountHolderName: string;
  accountNumberMasked: string;
  routingOrIban: string;
  idempotencyKey: string;
}

export interface PayoutDisbursementResult {
  success: boolean;
  providerReference: string;
  providerStatus: "SUBMITTED" | "SUCCESS" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
  settledAt?: Date;
}

export interface IPayoutProviderAdapter {
  readonly providerName: string;
  disburse(
    request: PayoutDisbursementRequest,
  ): Promise<PayoutDisbursementResult>;
  verifyStatus(providerReference: string): Promise<PayoutDisbursementResult>;
}
