import {
  InventoryItemStatus,
  adjustInventory,
  confirmInventoryReservation,
  createInventoryItem,
  expireInventoryReservation,
  listInventoryItems,
  listInventoryMovements,
  listLowStockInventory,
  releaseInventoryReservation,
  reserveInventory,
  restockInventory,
} from "@repo/inventory-db";
import {
  InventoryAdjustmentSchema,
  InventoryListQuerySchema,
  InventoryLookupQuerySchema,
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
import { logger } from "../observability/metrics.js";
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

inventoryRoute.get("/:productId", shouldBeUser, async (c) => {
  try {
    return await getAvailability(c);
  } catch (error) {
    logger.error("Failed to read inventory", error);
    return c.json({ message: "Failed to read inventory" }, 500);
  }
});

inventoryRoute.get("/:productId/availability", shouldBeUser, async (c) => {
  try {
    return await getAvailability(c);
  } catch (error) {
    logger.error("Failed to read inventory availability", error);
    return c.json({ message: "Failed to read inventory availability" }, 500);
  }
});

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
    await publish("inventory.low_stock", payload);
  }
}
inventoryRoute.post("/items", shouldBeAdmin, async (c) => {
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
  }
});

inventoryRoute.post("/reservations", shouldBeUser, async (c) => {
  try {
    const parsed = InventoryReservationSchema.safeParse(
      await c.req.json<unknown>(),
    );
    if (!parsed.success) return validationResponse(c, parsed.error);

    const reservation = await reserveInventory({
      ...parsed.data,
      userId: c.get("userId"),
    });
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
    logger.error("Failed to reserve inventory", error);
    return c.json({ message: errorMessage(error) }, 409);
  }
});

inventoryRoute.post("/reservations/:id/confirm", shouldBeUser, async (c) => {
  try {
    const reservation = await confirmInventoryReservation(
      c.req.param("id"),
      c.get("userId"),
    );
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
  }
});

inventoryRoute.post("/reservations/:id/release", shouldBeUser, async (c) => {
  try {
    const reservation = await releaseInventoryReservation(
      c.req.param("id"),
      c.get("userId"),
    );
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
  }
});

inventoryRoute.post("/reservations/:id/expire", shouldBeUser, async (c) => {
  try {
    const reservation = await expireInventoryReservation(
      c.req.param("id"),
      c.get("userId"),
    );
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
  }
});

inventoryRoute.post("/restock", shouldBeAdmin, async (c) => {
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
    await invalidateInventoryCache();
    await publishItemEvent("inventory.restocked", item);
    return c.json({ data: item });
  } catch (error) {
    logger.error("Failed to restock inventory", error);
    return c.json({ message: errorMessage(error) }, 409);
  }
});

inventoryRoute.post("/adjustments", shouldBeAdmin, async (c) => {
  try {
    const parsed = InventoryAdjustmentSchema.safeParse(
      await c.req.json<unknown>(),
    );
    if (!parsed.success) return validationResponse(c, parsed.error);
    const item = await adjustInventory(
      parsed.data,
      parsed.data.quantityDelta,
      parsed.data.movementType,
      parsed.data,
    );
    await invalidateInventoryCache();
    await publishItemEvent("inventory.adjusted", item);
    return c.json({ data: item });
  } catch (error) {
    logger.error("Failed to adjust inventory", error);
    return c.json({ message: errorMessage(error) }, 409);
  }
});

inventoryRoute.get("/admin/low-stock", shouldBeAdmin, async (c) => {
  const query = InventoryListQuerySchema.safeParse(c.req.query());
  if (!query.success) return validationResponse(c, query.error);
  return c.json({ data: await listLowStockInventory(query.data.limit) });
});

inventoryRoute.get("/admin/movements/:productId", shouldBeAdmin, async (c) => {
  const params = InventoryProductParamsSchema.safeParse(c.req.param());
  const query = InventoryListQuerySchema.safeParse(c.req.query());
  if (!params.success) return validationResponse(c, params.error);
  if (!query.success) return validationResponse(c, query.error);

  const items = await listInventoryItems({ productId: params.data.productId });
  const movements = await Promise.all(
    items.map((item) =>
      listInventoryMovements(
        {
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: item.warehouseId,
        },
        { limit: query.data.limit },
      ),
    ),
  );
  return c.json({ data: movements.flat() });
});

export default inventoryRoute;
