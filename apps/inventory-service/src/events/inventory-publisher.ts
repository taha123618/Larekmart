import { InventoryItemStatus } from "@repo/inventory-db";
import { inventoryMetrics, logger } from "../observability/metrics.js";
import { producer } from "../utils/kafka.js";

export async function publish(
  topic: string,
  value: Record<string, unknown>,
  key?: string,
): Promise<void> {
  try {
    await producer.send(topic, { value }, key ? { key } : undefined);
  } catch (error) {
    logger.error(`Failed to publish ${topic}`, error);
  }
}

export function itemPayload(item: {
  id: string;
  productId: number;
  variantId: string;
  warehouseId: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  status: InventoryItemStatus;
}) {
  return {
    inventoryItemId: item.id,
    productId: item.productId,
    variantId: item.variantId,
    warehouseId: item.warehouseId,
    quantity: item.quantity,
    availableQuantity: item.availableQuantity,
    reservedQuantity: item.reservedQuantity,
    soldQuantity: item.soldQuantity,
    status: item.status,
    occurredAt: new Date().toISOString(),
  };
}

export async function publishItemEvent(
  topic: string,
  item: Parameters<typeof itemPayload>[0],
  extra: Record<string, unknown> = {},
): Promise<void> {
  const payload = { ...itemPayload(item), ...extra };
  await publish(topic, payload, `${item.productId}:${item.variantId}`);

  if (
    item.status === InventoryItemStatus.LOW_STOCK ||
    item.status === InventoryItemStatus.OUT_OF_STOCK
  ) {
    inventoryMetrics.lowStockAlertsTotal.inc();
    await publish(
      "inventory.low_stock",
      payload,
      `${item.productId}:${item.variantId}`,
    );

    // Send alert notification for operations monitoring
    await publish("notification.dispatch", {
      type: "ALERT",
      title: `Low Stock Alert: Product ${item.productId}`,
      body: `Variant ${item.variantId} in warehouse ${item.warehouseId} has reached status ${item.status} (${item.availableQuantity} available)`,
      metadata: payload,
    });
  }
}
