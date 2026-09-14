import {
  InventoryItemStatus,
  InventoryMovementType,
  adjustInventory,
  confirmInventoryReservation,
  createInventoryItem,
  expireInventoryReservation,
  expireStaleReservations,
  listInventoryItems,
  listAllInventoryItems,
  listInventoryMovements,
  listLowStockInventory,
  listMovements,
  releaseInventoryReservation,
  reserveInventory,
  restockInventory,
} from "@repo/inventory-db";
import {
  InventoryAdjustmentSchema,
  InventoryItemsQuerySchema,
  InventoryListQuerySchema,
  InventoryLookupQuerySchema,
  InventoryMovementQuerySchema,
  InventoryProductParamsSchema,
  InventoryReservationSchema,
  InventoryRestockSchema,
} from "@repo/types";
import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  shouldBeAdmin,
  shouldBeUser,
  type AuthVariables,
} from "../middleware/authMiddleware.js";
import {
  availabilityFromItems,
  invalidateInventoryCache,
  readAvailability,
  writeAvailability,
} from "../cache/inventory-cache.js";
import { inventoryMetrics, logger } from "../observability/metrics.js";
import { producer } from "../utils/kafka.js";

const inventoryRoute = new Hono<{ Variables: AuthVariables }>();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Inventory operation failed";
}

function validationResponse(
  c: Context<{ Variables: AuthVariables }>,
  error: z.ZodError,
) {
  return c.json({ message: "Invalid request", issues: error.issues }, 400);
}

async function publish(
  topic: string,
  value: Record<string, unknown>,
): Promise<void> {
  try {
    await producer.send(topic, { value });
  } catch (error) {
    logger.error(`Failed to publish ${topic}`, error);
  }
}

function itemPayload(item: {
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

async function publishItemEvent(
  topic: string,
  item: Parameters<typeof itemPayload>[0],
  extra: Record<string, unknown> = {},
): Promise<void> {
  const payload = { ...itemPayload(item), ...extra };
  await publish(topic, payload);

  if (
    item.status === InventoryItemStatus.LOW_STOCK ||
    item.status === InventoryItemStatus.OUT_OF_STOCK
  ) {
    inventoryMetrics.lowStockAlertsTotal.inc();
    await publish("inventory.low_stock", payload);

    // Send alert notification for operations monitoring
    await publish("notification.dispatch", {
      type: "ALERT",
      title: `Low Stock Alert: Product ${item.productId}`,
      body: `Variant ${item.variantId} in warehouse ${item.warehouseId} has reached status ${item.status} (${item.availableQuantity} available)`,
      metadata: payload,
    });
  }
}

async function getAvailability(c: Context<{ Variables: AuthVariables }>) {
  const params = InventoryProductParamsSchema.safeParse(c.req.param());
  const query = InventoryLookupQuerySchema.safeParse(c.req.query());
  if (!params.success) return validationResponse(c, params.error);
  if (!query.success) return validationResponse(c, query.error);

  const cached = await readAvailability(
    params.data.productId,
    query.data.variantId,
    query.data.warehouseId,
  );
  if (cached) return c.json({ data: cached });

  const items = await listInventoryItems({
    productId: params.data.productId,
    variantId: query.data.variantId,
    warehouseId: query.data.warehouseId,
  });
  const availability = availabilityFromItems(
    params.data.productId,
    items,
    query.data.variantId,
    query.data.warehouseId,
  );
  await writeAvailability(availability);
  return c.json({ data: availability });
}

// =========================================================================
// 1. Static Admin & Query Routes (Registered BEFORE /:productId to prevent
//    path parameter collision in router matching)
// =========================================================================

/**
 * GET /api/v1/inventory/items
 * Admin endpoint listing all inventory items across products and warehouses.
 */
inventoryRoute.get("/items", shouldBeAdmin, async (c) => {
  const query = InventoryItemsQuerySchema.safeParse(c.req.query());
  if (!query.success) return validationResponse(c, query.error);
  const items = await listAllInventoryItems({
    productId: query.data.productId,
    variantId: query.data.variantId,
    warehouseId: query.data.warehouseId,
    status: query.data.status as InventoryItemStatus | undefined,
    limit: query.data.limit,
  });
  return c.json({ data: items });
});

/**
 * Alias: GET /api/v1/inventory/admin/items
 */
inventoryRoute.get("/admin/items", shouldBeAdmin, async (c) => {
  const query = InventoryItemsQuerySchema.safeParse(c.req.query());
  if (!query.success) return validationResponse(c, query.error);
  const items = await listAllInventoryItems({
    productId: query.data.productId,
    variantId: query.data.variantId,
    warehouseId: query.data.warehouseId,
    status: query.data.status as InventoryItemStatus | undefined,
    limit: query.data.limit,
  });
  return c.json({ data: items });
});

/**
 * GET /api/v1/inventory/low-stock
 * Admin endpoint listing items that are low in stock or out of stock.
 */
inventoryRoute.get("/low-stock", shouldBeAdmin, async (c) => {
  const query = InventoryListQuerySchema.safeParse(c.req.query());
  if (!query.success) return validationResponse(c, query.error);
  const items = await listLowStockInventory(query.data.limit);
  return c.json({ data: items });
});

/**
 * Alias: GET /api/v1/inventory/admin/low-stock
 */
inventoryRoute.get("/admin/low-stock", shouldBeAdmin, async (c) => {
  const query = InventoryListQuerySchema.safeParse(c.req.query());
  if (!query.success) return validationResponse(c, query.error);
  const items = await listLowStockInventory(query.data.limit);
  return c.json({ data: items });
});

/**
 * GET /api/v1/inventory/movements
 * Admin endpoint querying the append-only inventory movement ledger.
 */
inventoryRoute.get("/movements", shouldBeAdmin, async (c) => {
  const query = InventoryMovementQuerySchema.safeParse(c.req.query());
  if (!query.success) return validationResponse(c, query.error);

  const movements = await listMovements({
    productId: query.data.productId,
    variantId: query.data.variantId,
    warehouseId: query.data.warehouseId,
    type: query.data.type as InventoryMovementType | undefined,
    limit: query.data.limit,
    cursor: query.data.cursor,
  });

  return c.json({ data: movements });
});

/**
 * GET /api/v1/inventory/movements/:productId
 * Admin endpoint querying movements specifically for a product across warehouses.
 */
inventoryRoute.get("/movements/:productId", shouldBeAdmin, async (c) => {
  const params = InventoryProductParamsSchema.safeParse(c.req.param());
  const query = InventoryListQuerySchema.safeParse(c.req.query());
  if (!params.success) return validationResponse(c, params.error);
  if (!query.success) return validationResponse(c, query.error);

  const movements = await listMovements({
    productId: params.data.productId,
    limit: query.data.limit,
  });
  return c.json({ data: movements });
});

/**
 * Alias: GET /api/v1/inventory/admin/movements/:productId
 */
inventoryRoute.get("/admin/movements/:productId", shouldBeAdmin, async (c) => {
  const params = InventoryProductParamsSchema.safeParse(c.req.param());
  const query = InventoryListQuerySchema.safeParse(c.req.query());
  if (!params.success) return validationResponse(c, params.error);
  if (!query.success) return validationResponse(c, query.error);

  const movements = await listMovements({
    productId: params.data.productId,
    limit: query.data.limit,
  });
  return c.json({ data: movements });
});

// =========================================================================
// 2. Stock Creation, Restock, & Adjustment Mutations
// =========================================================================

/**
 * POST /api/v1/inventory/items
 * Create an inventory item for a product variant at a warehouse.
 */
inventoryRoute.post("/items", shouldBeAdmin, async (c) => {
  const start = performance.now();
  try {
    const body = await c.req.json<unknown>();
    const parsed = InventoryRestockSchema.pick({
      productId: true,
      variantId: true,
      warehouseId: true,
      quantity: true,
    }).safeParse(body);
    if (!parsed.success) return validationResponse(c, parsed.error);

    const item = await createInventoryItem(parsed.data);
    await invalidateInventoryCache();
    await publishItemEvent("inventory.created", item);
    return c.json({ data: item }, 201);
  } catch (error) {
    logger.error("Failed to create inventory item", error);
    return c.json({ message: errorMessage(error) }, 400);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "create_item" },
      (performance.now() - start) / 1000,
    );
  }
});

/**
 * POST /api/v1/inventory/restock
 * Restock available inventory units with ledger auditing.
 */
inventoryRoute.post("/restock", shouldBeAdmin, async (c) => {
  const start = performance.now();
  try {
    const parsed = InventoryRestockSchema.safeParse(
      await c.req.json<unknown>(),
    );
    if (!parsed.success) return validationResponse(c, parsed.error);

    const item = await restockInventory(
      parsed.data,
      parsed.data.quantity,
      parsed.data,
    );
    inventoryMetrics.restocksTotal.inc();
    await invalidateInventoryCache();
    await publishItemEvent("inventory.restocked", item);
    return c.json({ data: item });
  } catch (error) {
    logger.error("Failed to restock inventory", error);
    return c.json({ message: errorMessage(error) }, 409);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "restock" },
      (performance.now() - start) / 1000,
    );
  }
});

/**
 * POST /api/v1/inventory/adjustments
 * Perform an atomic adjustment (reconciliation, damage write-off, return) with audit ledger.
 */
inventoryRoute.post("/adjustments", shouldBeAdmin, async (c) => {
  const start = performance.now();
  try {
    const parsed = InventoryAdjustmentSchema.safeParse(
      await c.req.json<unknown>(),
    );
    if (!parsed.success) return validationResponse(c, parsed.error);

    const item = await adjustInventory(
      parsed.data,
      parsed.data.quantityDelta,
      parsed.data.movementType as InventoryMovementType,
      parsed.data,
    );
    inventoryMetrics.adjustmentsTotal.inc();
    await invalidateInventoryCache();
    await publishItemEvent("inventory.adjusted", item);
    return c.json({ data: item });
  } catch (error) {
    logger.error("Failed to adjust inventory", error);
    return c.json({ message: errorMessage(error) }, 409);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "adjustment" },
      (performance.now() - start) / 1000,
    );
  }
});

// =========================================================================
// 3. Reservation Lifecycle (Prevent Overselling, Confirm, Release, Expire)
// =========================================================================

/**
 * POST /api/v1/inventory/reservations
 * Atomically reserve stock during checkout.
 * Enforces PostgreSQL row-level locking conditional decrement (availableQuantity >= quantity).
 */
inventoryRoute.post("/reservations", shouldBeUser, async (c) => {
  const start = performance.now();
  try {
    const parsed = InventoryReservationSchema.safeParse(
      await c.req.json<unknown>(),
    );
    if (!parsed.success) return validationResponse(c, parsed.error);

    const reservation = await reserveInventory({
      ...parsed.data,
      userId: c.get("userId"),
    });

    inventoryMetrics.reservationsCreatedTotal.inc();
    await invalidateInventoryCache();
    await publishItemEvent("inventory.reserved", reservation.inventoryItem, {
      reservationId: reservation.id,
      quantity: reservation.quantity,
      referenceType: reservation.referenceType,
      referenceId: reservation.referenceId,
      expiresAt: reservation.expiresAt.toISOString(),
    });

    return c.json({ data: reservation }, 201);
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes("Insufficient inventory")) {
      inventoryMetrics.oversellPreventedTotal.inc();
    }
    logger.warn("Inventory reservation rejected", { error: message });
    return c.json({ message }, 409);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "reserve" },
      (performance.now() - start) / 1000,
    );
  }
});

/**
 * POST /api/v1/inventory/reservations/:id/confirm
 * Transitions reservation to CONFIRMED and converts reserved units to sold units.
 */
inventoryRoute.post("/reservations/:id/confirm", shouldBeUser, async (c) => {
  const start = performance.now();
  try {
    const reservation = await confirmInventoryReservation(
      c.req.param("id"),
      c.get("userId"),
    );
    inventoryMetrics.reservationsConfirmedTotal.inc();
    await invalidateInventoryCache();
    await publishItemEvent(
      "inventory.reservation.confirmed",
      reservation.inventoryItem,
      {
        reservationId: reservation.id,
        quantity: reservation.quantity,
        referenceType: reservation.referenceType,
        referenceId: reservation.referenceId,
      },
    );
    return c.json({ data: reservation });
  } catch (error) {
    logger.error("Failed to confirm inventory reservation", error);
    return c.json({ message: errorMessage(error) }, 409);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "confirm_reservation" },
      (performance.now() - start) / 1000,
    );
  }
});

/**
 * POST /api/v1/inventory/reservations/:id/release
 * Transitions reservation to RELEASED and returns reserved units back to available stock.
 */
inventoryRoute.post("/reservations/:id/release", shouldBeUser, async (c) => {
  const start = performance.now();
  try {
    const reservation = await releaseInventoryReservation(
      c.req.param("id"),
      c.get("userId"),
    );
    inventoryMetrics.reservationsReleasedTotal.inc();
    await invalidateInventoryCache();
    await publishItemEvent("inventory.released", reservation.inventoryItem, {
      reservationId: reservation.id,
      quantity: reservation.quantity,
      referenceType: reservation.referenceType,
      referenceId: reservation.referenceId,
    });
    return c.json({ data: reservation });
  } catch (error) {
    logger.error("Failed to release inventory reservation", error);
    return c.json({ message: errorMessage(error) }, 409);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "release_reservation" },
      (performance.now() - start) / 1000,
    );
  }
});

/**
 * POST /api/v1/inventory/reservations/:id/expire
 * Marks an individual expired reservation and returns stock to availability.
 */
inventoryRoute.post("/reservations/:id/expire", shouldBeUser, async (c) => {
  const start = performance.now();
  try {
    const reservation = await expireInventoryReservation(
      c.req.param("id"),
      c.get("userId"),
    );
    inventoryMetrics.reservationsExpiredTotal.inc();
    await invalidateInventoryCache();
    await publishItemEvent(
      "inventory.reservation.expired",
      reservation.inventoryItem,
      {
        reservationId: reservation.id,
        quantity: reservation.quantity,
        referenceType: reservation.referenceType,
        referenceId: reservation.referenceId,
      },
    );
    return c.json({ data: reservation });
  } catch (error) {
    logger.error("Failed to expire inventory reservation", error);
    return c.json({ message: errorMessage(error) }, 409);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "expire_reservation" },
      (performance.now() - start) / 1000,
    );
  }
});

/**
 * POST /api/v1/inventory/reservations/expire-stale
 * Admin/system worker endpoint to sweep all past-expiry reservations in batch.
 */
inventoryRoute.post("/reservations/expire-stale", shouldBeAdmin, async (c) => {
  const start = performance.now();
  try {
    const expiredList = await expireStaleReservations();
    if (expiredList.length > 0) {
      inventoryMetrics.reservationsExpiredTotal.inc({}, expiredList.length);
      await invalidateInventoryCache();
      for (const item of expiredList) {
        await publishItemEvent(
          "inventory.reservation.expired",
          item.inventoryItem,
          {
            reservationId: item.id,
            quantity: item.quantity,
            referenceType: item.referenceType,
            referenceId: item.referenceId,
          },
        );
      }
    }
    return c.json({ count: expiredList.length, expired: expiredList });
  } catch (error) {
    logger.error("Failed to sweep stale reservations", error);
    return c.json({ message: errorMessage(error) }, 500);
  } finally {
    inventoryMetrics.operationDurationSeconds.observe(
      { operation: "expire_stale_batch" },
      (performance.now() - start) / 1000,
    );
  }
});

// =========================================================================
// 4. Product Availability Query Routes (Parametric :productId)
// =========================================================================

/**
 * GET /api/v1/inventory/:productId
 * Customer/Client availability check for a product (public read).
 */
inventoryRoute.get("/:productId", async (c) => {
  try {
    return await getAvailability(c);
  } catch (error) {
    logger.error("Failed to read inventory", error);
    return c.json({ message: "Failed to read inventory" }, 500);
  }
});

/**
 * GET /api/v1/inventory/:productId/availability
 * Explicit availability check endpoint (public read).
 */
inventoryRoute.get("/:productId/availability", async (c) => {
  try {
    return await getAvailability(c);
  } catch (error) {
    logger.error("Failed to read inventory availability", error);
    return c.json({ message: "Failed to read inventory availability" }, 500);
  }
});

export default inventoryRoute;
