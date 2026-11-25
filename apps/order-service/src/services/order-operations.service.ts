import { z } from "zod";

export interface OrderLineItem {
  productId: string | number;
  name?: string;
  sellerId?: string | null;
  quantity: number;
  price: number;
}

export interface SellerOrderSplit {
  sellerId: string;
  items: OrderLineItem[];
  subtotal: number;
  proportionalTax: number;
  proportionalShipping: number;
  total: number;
}

export interface PartialFulfillmentRecord {
  fulfillmentId: string;
  orderId: string;
  sellerId: string;
  items: Array<{ productId: string; quantityFulfilled: number }>;
  carrier?: string;
  trackingNumber?: string;
  createdAt: string;
}

export interface BackorderItemRecord {
  backorderId: string;
  orderId: string;
  productId: string;
  backorderQuantity: number;
  expectedRestockDate?: string;
  status: "PENDING_RESTOCK" | "ALLOCATED" | "CANCELLED";
  createdAt: string;
}

export interface OrderAmendmentRecord {
  amendmentId: string;
  orderId: string;
  actorId: string;
  type: "SHIPPING_ADDRESS" | "QUANTITY_ADJUSTMENT" | "ORDER_NOTE";
  reason: string;
  previousValue: unknown;
  newValue: unknown;
  createdAt: string;
}

export const PartialFulfillmentSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantityFulfilled: z.number().int().positive(),
      }),
    )
    .min(1),
  carrier: z.string().max(64).optional(),
  trackingNumber: z.string().max(128).optional(),
});

export const BackorderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        backorderQuantity: z.number().int().positive(),
        expectedRestockDate: z.string().optional(),
      }),
    )
    .min(1),
});

export const OrderAmendmentSchema = z.object({
  type: z.enum(["SHIPPING_ADDRESS", "QUANTITY_ADJUSTMENT", "ORDER_NOTE"]),
  reason: z.string().min(3).max(500),
  newValue: z.unknown(),
});

// In-memory operational ledger backed by order-level state for rapid fulfillment & amendment tracking
const fulfillmentLedger = new Map<string, PartialFulfillmentRecord[]>();
const backorderLedger = new Map<string, BackorderItemRecord[]>();
const amendmentLedger = new Map<string, OrderAmendmentRecord[]>();

/**
 * Splits a multi-vendor order into seller-scoped sub-orders with proportional tax and shipping.
 */
export function splitOrderBySeller(params: {
  items: OrderLineItem[];
  totalTax?: number;
  totalShipping?: number;
  defaultSellerId?: string;
}): SellerOrderSplit[] {
  const { items, totalTax = 0, totalShipping = 0, defaultSellerId = "platform" } = params;
  const groups = new Map<string, OrderLineItem[]>();

  let totalMerchandise = 0;
  for (const item of items) {
    const sid = item.sellerId || defaultSellerId;
    const list = groups.get(sid) ?? [];
    list.push(item);
    groups.set(sid, list);
    totalMerchandise += Number(item.price) * Number(item.quantity);
  }

  const splits: SellerOrderSplit[] = [];
  for (const [sellerId, sellerItems] of groups.entries()) {
    const subtotal = sellerItems.reduce(
      (sum, i) => sum + Number(i.price) * Number(i.quantity),
      0,
    );
    const ratio = totalMerchandise > 0 ? subtotal / totalMerchandise : 0;
    const proportionalTax = Number((totalTax * ratio).toFixed(2));
    const proportionalShipping = Number((totalShipping * ratio).toFixed(2));
    const total = Number((subtotal + proportionalTax + proportionalShipping).toFixed(2));

    splits.push({
      sellerId,
      items: sellerItems,
      subtotal: Number(subtotal.toFixed(2)),
      proportionalTax,
      proportionalShipping,
      total,
    });
  }

  return splits;
}

/**
 * Records a partial fulfillment shipment against an order and returns updated progress.
 */
export function recordPartialFulfillment(params: {
  orderId: string;
  sellerId: string;
  orderItems: Array<{ productId?: string | number; quantity: number }>;
  fulfillmentItems: Array<{ productId: string; quantityFulfilled: number }>;
  carrier?: string;
  trackingNumber?: string;
}): {
  record: PartialFulfillmentRecord;
  isFullyFulfilled: boolean;
  totalFulfilledUnits: number;
  totalOrderedUnits: number;
} {
  const existing = fulfillmentLedger.get(params.orderId) ?? [];

  const fulfilledByProduct = new Map<string, number>();
  for (const rec of existing) {
    for (const item of rec.items) {
      fulfilledByProduct.set(
        item.productId,
        (fulfilledByProduct.get(item.productId) ?? 0) + item.quantityFulfilled,
      );
    }
  }

  for (const item of params.fulfillmentItems) {
    const ordered = params.orderItems.find(
      (oi) => String(oi.productId) === String(item.productId),
    );
    if (!ordered) {
      throw new Error(`Product ${item.productId} does not belong to order ${params.orderId}`);
    }
    const alreadyFulfilled = fulfilledByProduct.get(item.productId) ?? 0;
    if (alreadyFulfilled + item.quantityFulfilled > ordered.quantity) {
      throw new Error(
        `Fulfillment quantity (${alreadyFulfilled + item.quantityFulfilled}) exceeds ordered quantity (${ordered.quantity}) for product ${item.productId}`,
      );
    }
    fulfilledByProduct.set(item.productId, alreadyFulfilled + item.quantityFulfilled);
  }

  const record: PartialFulfillmentRecord = {
    fulfillmentId: `ful_${crypto.randomUUID().slice(0, 12)}`,
    orderId: params.orderId,
    sellerId: params.sellerId,
    items: params.fulfillmentItems,
    carrier: params.carrier,
    trackingNumber: params.trackingNumber,
    createdAt: new Date().toISOString(),
  };

  existing.push(record);
  fulfillmentLedger.set(params.orderId, existing);

  const totalOrderedUnits = params.orderItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalFulfilledUnits = Array.from(fulfilledByProduct.values()).reduce(
    (sum, q) => sum + q,
    0,
  );

  return {
    record,
    isFullyFulfilled: totalFulfilledUnits >= totalOrderedUnits,
    totalFulfilledUnits,
    totalOrderedUnits,
  };
}

/**
 * Registers backorder items for an order when stock is awaiting replenishment.
 */
export function registerBackorders(params: {
  orderId: string;
  items: Array<{
    productId: string;
    backorderQuantity: number;
    expectedRestockDate?: string;
  }>;
}): BackorderItemRecord[] {
  const existing = backorderLedger.get(params.orderId) ?? [];
  const created: BackorderItemRecord[] = params.items.map((item) => ({
    backorderId: `bo_${crypto.randomUUID().slice(0, 12)}`,
    orderId: params.orderId,
    productId: item.productId,
    backorderQuantity: item.backorderQuantity,
    expectedRestockDate: item.expectedRestockDate,
    status: "PENDING_RESTOCK",
    createdAt: new Date().toISOString(),
  }));

  backorderLedger.set(params.orderId, [...existing, ...created]);
  return created;
}

export function getOrderBackorders(orderId: string): BackorderItemRecord[] {
  return backorderLedger.get(orderId) ?? [];
}

/**
 * Records an auditable order amendment (pre-shipment address change, quantity edit, or note).
 */
export function recordOrderAmendment(params: {
  orderId: string;
  actorId: string;
  currentStatus: string;
  type: "SHIPPING_ADDRESS" | "QUANTITY_ADJUSTMENT" | "ORDER_NOTE";
  reason: string;
  previousValue: unknown;
  newValue: unknown;
}): OrderAmendmentRecord {
  const lockedStatuses = new Set(["shipped", "delivered", "cancelled", "refunded"]);
  if (params.type !== "ORDER_NOTE" && lockedStatuses.has(params.currentStatus.toLowerCase())) {
    throw new Error(
      `Cannot apply ${params.type} amendment when order status is ${params.currentStatus}`,
    );
  }

  const record: OrderAmendmentRecord = {
    amendmentId: `amd_${crypto.randomUUID().slice(0, 12)}`,
    orderId: params.orderId,
    actorId: params.actorId,
    type: params.type,
    reason: params.reason,
    previousValue: params.previousValue,
    newValue: params.newValue,
    createdAt: new Date().toISOString(),
  };

  const existing = amendmentLedger.get(params.orderId) ?? [];
  existing.push(record);
  amendmentLedger.set(params.orderId, existing);
  return record;
}

export function getOrderAmendments(orderId: string): OrderAmendmentRecord[] {
  return amendmentLedger.get(orderId) ?? [];
}

export function getOrderFulfillments(orderId: string): PartialFulfillmentRecord[] {
  return fulfillmentLedger.get(orderId) ?? [];
}
