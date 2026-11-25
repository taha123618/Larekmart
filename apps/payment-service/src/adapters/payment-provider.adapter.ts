import crypto from "node:crypto";

export type SupportedPaymentProvider = "STRIPE" | "JAZZCASH" | "EASYPAISA" | "COD";

function verifyHmacSha256(payload: string, signature: string, secret: string): boolean {
  if (!payload || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export interface PaymentIntentRequest {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  provider: SupportedPaymentProvider;
  providerReference: string;
  status: "REQUIRES_ACTION" | "AUTHORIZED" | "CAPTURED" | "PENDING_COLLECTION";
  redirectUrl?: string;
}

export interface PaymentProviderAdapter {
  readonly provider: SupportedPaymentProvider;
  createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResult>;
  verifySignature(payload: string, signature: string): boolean;
}

export class StripeProviderAdapter implements PaymentProviderAdapter {
  readonly provider: SupportedPaymentProvider = "STRIPE";

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    return {
      provider: this.provider,
      providerReference: `pi_${req.orderId}_${Date.now()}`,
      status: "REQUIRES_ACTION",
    };
  }

  verifySignature(_payload: string, signature: string): boolean {
    return Boolean(signature && signature.startsWith("t="));
  }
}

export class JazzCashProviderAdapter implements PaymentProviderAdapter {
  readonly provider: SupportedPaymentProvider = "JAZZCASH";

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    return {
      provider: this.provider,
      providerReference: `jc_${req.orderId}_${Date.now()}`,
      status: "REQUIRES_ACTION",
      redirectUrl: `https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform?ref=${req.orderId}`,
    };
  }

  verifySignature(payload: string, signature: string): boolean {
    const secret = process.env.JAZZCASH_INTEGRITY_SALT || "test_jazzcash_salt";
    return verifyHmacSha256(payload, signature, secret);
  }
}

export class EasyPaisaProviderAdapter implements PaymentProviderAdapter {
  readonly provider: SupportedPaymentProvider = "EASYPAISA";

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    return {
      provider: this.provider,
      providerReference: `ep_${req.orderId}_${Date.now()}`,
      status: "REQUIRES_ACTION",
      redirectUrl: `https://easypaystg.easypaisa.com.pk/easypay/Index.jsf?orderRef=${req.orderId}`,
    };
  }

  verifySignature(payload: string, signature: string): boolean {
    const secret = process.env.EASYPAISA_HASH_KEY || "test_easypaisa_key";
    return verifyHmacSha256(payload, signature, secret);
  }
}

export class CodProviderAdapter implements PaymentProviderAdapter {
  readonly provider: SupportedPaymentProvider = "COD";

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    return {
      provider: this.provider,
      providerReference: `cod_${req.orderId}_${Date.now()}`,
      status: "PENDING_COLLECTION",
    };
  }

  verifySignature(_payload: string, _signature: string): boolean {
    return true;
  }
}

const ADAPTERS: Record<SupportedPaymentProvider, PaymentProviderAdapter> = {
  STRIPE: new StripeProviderAdapter(),
  JAZZCASH: new JazzCashProviderAdapter(),
  EASYPAISA: new EasyPaisaProviderAdapter(),
  COD: new CodProviderAdapter(),
};

export function getPaymentProviderAdapter(
  provider: SupportedPaymentProvider,
): PaymentProviderAdapter {
  return ADAPTERS[provider];
}
