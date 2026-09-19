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
  products: {
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
  products?: unknown;
};
