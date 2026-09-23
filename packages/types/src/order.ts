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
