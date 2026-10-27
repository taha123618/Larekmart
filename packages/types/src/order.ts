import { z } from "zod";
import { OrderSchemaType } from "@repo/order-db";

export type OrderType = OrderSchemaType & {
  _id: string;
};

export type OrderChartType = {
  month: string;
  total: number;
  successful: number;
};

export type PaymentSuccessfulType = {
  sessionId?: string | null;
  referenceId?: string | null;
  reservationId?: string | null;
  cartId?: string | null;
  userId?: string | null;
  email?: string | null;
  amount: number;
  taxAmount?: number | null;
  taxCalculationId?: string | null;
  status: "success" | "failed";
  paymentMethod?: string | null;
  carrier?: string | null;
  serviceType?: string | null;
  shippingRateAmount?: number | null;
  isCod?: boolean | null;
  codAmount?: number | null;
  codFee?: number | null;
  shippingAddress?: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
  } | null;
  products: {
    productId?: string | null;
    name?: string | null;
    quantity?: number | null;
    price?: number | null;
  }[];
};

export type OrderCreatedType = {
  orderId?: string;
  userId?: string | null;
  cartId?: string | null;
  reservationId?: string | null;
  couponCode?: string | null;
  email: string;
  amount: number;
  taxAmount?: number | null;
  taxCalculationId?: string | null;
  status: "success" | "failed";
  paymentMethod?: string | null;
  carrier?: string | null;
  serviceType?: string | null;
  shippingRateAmount?: number | null;
  isCod?: boolean | null;
  codAmount?: number | null;
  codFee?: number | null;
  shippingAddress?: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
  } | null;
  products?: unknown;
};

/**
 * COD order contract. ALL monetary values are integers in paisa (1/100 PKR).
 *
 * `amount` is the client's declared total, kept ONLY as a cross-check: the
 * server recomputes the authoritative total from catalog prices plus the
 * declared shipping/COD/discount/tax components and rejects mismatches. The
 * client-declared per-product `price` fields are ignored for pricing.
 */
export const CreateCodOrderSchema = z.object({
  email: z.string().email(),
  amount: z.number().int().positive(),
  discountTotal: z.number().int().nonnegative().default(0),
  taxTotal: z.number().int().nonnegative().default(0),
  taxCalculationId: z.string().optional(),
  reservationId: z.string().optional(),
  couponCode: z.string().optional(),
  carrier: z.string().optional(),
  serviceType: z.string().optional(),
  shippingRateAmount: z.number().nonnegative().optional(),
  codFee: z.number().nonnegative().optional(),
  shippingAddress: z.object({
    fullName: z.string().min(1).max(200),
    phone: z.string().min(1).max(50),
    addressLine1: z.string().min(1).max(200),
    addressLine2: z.string().max(200).nullable().optional(),
    city: z.string().min(1).max(100),
    state: z.string().max(100).nullable().optional(),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(1).max(100),
  }),
  products: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.number().int().positive(),
        /** Client-declared unit price in paisa — informational only. */
        price: z.number().positive().optional(),
      }),
    )
    .min(1),
});

export type CreateCodOrderInput = z.infer<typeof CreateCodOrderSchema>;

export interface OrderConfirmedPayload {
  orderId: string;
  userId: string;
  email?: string;
  cartId?: string | null;
  paymentSessionId?: string | null;
  reservationId?: string | null;
  amount: number;
  products: Array<{
    productId?: string | number | null;
    name?: string | null;
    quantity?: number | null;
    price?: number | null;
    sellerId?: string | null;
  }>;
  shippingAddress?: unknown;
  confirmedAt: string;
}

export interface PaymentRefundRequestedPayload {
  orderId: string;
  paymentSessionId: string;
  amount?: number;
  reason: string;
  userId?: string | null;
  requestedAt: string;
}

export interface PaymentRefundCompletedPayload {
  orderId: string;
  refundId: string;
  paymentSessionId: string;
  amount: number;
  status: "succeeded" | "failed";
  completedAt: string;
}

export interface OrderCancelledPayload {
  orderId: string;
  userId?: string | null;
  reason: string;
  cancelledAt: string;
}
