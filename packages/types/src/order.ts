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
  email: string;
  amount: number;
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

export const CreateCodOrderSchema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
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
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      }),
    )
    .min(1),
});

export type CreateCodOrderInput = z.infer<typeof CreateCodOrderSchema>;
