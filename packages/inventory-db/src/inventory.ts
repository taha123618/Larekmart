import {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryReservationStatus,
  WarehouseStatus,
  type InventoryItem,
  type InventoryMovement,
  type InventoryReservation,
  type Warehouse,
  Prisma,
} from "../generated/prisma";
import { prisma } from "./client";
import {
  InsufficientStockError,
  InventoryNotFoundError,
  InvalidInventoryStateError,
  ReservationAlreadyConfirmedError,
  ReservationAlreadyReleasedError,
  ReservationNotFoundError,
  WarehouseNotFoundError,
} from "./errors";

export interface InventoryItemKey {
  productId: number;
  variantId: string;
  warehouseId: string;
}

export interface ReserveInventoryInput extends InventoryItemKey {
  userId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  expiresAt: Date;
}

export interface InventoryMutationReference {
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
}

export type InventoryReservationWithItem = InventoryReservation & {
  inventoryItem: InventoryItem;
};

export type InventoryMovementWithItem = InventoryMovement & {
  inventoryItem: InventoryItem;
};

export interface InventoryLookup {
  productId: number;
  variantId?: string;
  warehouseId?: string;
}

export interface InventoryAvailabilityResult {
  productId: number;
  totalAvailable: number;
  totalReserved: number;
  totalSold: number;
  totalPhysical: number;
  items: InventoryItem[];
}

export interface TransferInventoryInput {
  productId: number;
  variantId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface TransferInventoryResult {
  fromItem: InventoryItem;
  toItem: InventoryItem;
  outMovement: InventoryMovement;
  inMovement: InventoryMovement;
}

export interface CreateWarehouseInput {
  id?: string;
  name: string;
  code: string;
  status?: WarehouseStatus;
  address?: string;
}

export interface CreateMovementInput {
  inventoryItemId: string;
  type: InventoryMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface MovementFilter {
  productId?: number;
  variantId?: string;
  warehouseId?: string;
  type?: InventoryMovementType;
  limit?: number;
  cursor?: string;
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Inventory quantity must be a positive integer");
  }
}

function statusFor(
  item: Pick<InventoryItem, "availableQuantity" | "reorderPoint">,
): InventoryItemStatus {
  if (item.availableQuantity <= 0) return InventoryItemStatus.OUT_OF_STOCK;
  if (item.availableQuantity <= item.reorderPoint)
    return InventoryItemStatus.LOW_STOCK;
  return InventoryItemStatus.ACTIVE;
}

function itemWhere(
  key: InventoryItemKey,
): Prisma.InventoryItemWhereUniqueInput {
  return {
    productId_variantId_warehouseId: key,
  };
}

/**
 * Creates an inventory item and records an initial ledger movement if quantity > 0.
 * Ensures the referenced warehouse exists or provisions a default record.
 * Operates inside a single transaction to maintain a complete audit trail.
 */
export async function createInventoryItem(
  input: InventoryItemKey & {
    quantity: number;
    reorderPoint?: number;
    status?: InventoryItemStatus;
  },
): Promise<InventoryItem> {
  assertPositiveQuantity(input.quantity);
  if (input.reorderPoint !== undefined && input.reorderPoint < 0) {
    throw new Error("Reorder point cannot be negative");
  }

  return prisma.$transaction(async (transaction) => {
    const existingWarehouse = await transaction.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!existingWarehouse) {
      await transaction.warehouse.create({
        data: {
          id: input.warehouseId,
          name: `Warehouse ${input.warehouseId}`,
          code: input.warehouseId.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
          status: WarehouseStatus.ACTIVE,
        },
      });
    }

    const item = await transaction.inventoryItem.create({
      data: {
        productId: input.productId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        availableQuantity: input.quantity,
        reorderPoint: input.reorderPoint ?? 0,
        status:
          input.status ??
          statusFor({
            availableQuantity: input.quantity,
            reorderPoint: input.reorderPoint ?? 0,
          }),
      },
    });

    if (input.quantity > 0) {
      await transaction.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: InventoryMovementType.PURCHASE,
          quantity: input.quantity,
          reason: "Initial inventory setup",
        },
      });
    }

    return item;
  });
}

export function getInventoryItem(
  key: InventoryItemKey,
): Promise<InventoryItem | null> {
  return prisma.inventoryItem.findUnique({
    where: itemWhere(key),
    include: { warehouse: true },
  });
}

/**
 * Retrieves consolidated inventory availability across warehouses for a product.
 */
export async function getInventoryAvailability(
  lookup: InventoryLookup,
): Promise<InventoryAvailabilityResult> {
  const items = await listInventoryItems(lookup);
  const totalAvailable = items.reduce(
    (acc, item) => acc + item.availableQuantity,
    0,
  );
  const totalReserved = items.reduce(
    (acc, item) => acc + item.reservedQuantity,
    0,
  );
  const totalSold = items.reduce((acc, item) => acc + item.soldQuantity, 0);
  const totalPhysical = items.reduce((acc, item) => acc + item.quantity, 0);

  return {
    productId: lookup.productId,
    totalAvailable,
    totalReserved,
    totalSold,
    totalPhysical,
    items,
  };
}

/**
 * Atomically reserves inventory using conditional update to strictly prevent overselling.
 *
 * PostgreSQL row-level locking ensures that concurrent requests for the same item
 * evaluate availableQuantity >= requested atomically without race conditions.
 */
export async function reserveInventory(
  input: ReserveInventoryInput,
): Promise<InventoryReservationWithItem> {
  assertPositiveQuantity(input.quantity);
  if (input.expiresAt <= new Date()) {
    throw new InvalidInventoryStateError(
      "Inventory reservation must expire in the future",
    );
  }

  return prisma.$transaction(async (transaction) => {
    // Atomic conditional decrement: only succeeds if availableQuantity >= requested
    const updated = await transaction.inventoryItem.updateMany({
      where: {
        ...itemWhere(input),
        status: { not: InventoryItemStatus.INACTIVE },
        availableQuantity: { gte: input.quantity },
      },
      data: {
        availableQuantity: { decrement: input.quantity },
        reservedQuantity: { increment: input.quantity },
        version: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      const existing = await transaction.inventoryItem.findUnique({
        where: itemWhere(input),
      });
      if (!existing) {
        throw new InventoryNotFoundError(
          `Product ${input.productId}, Variant ${input.variantId}, Warehouse ${input.warehouseId}`,
        );
      }
      if (existing.status === InventoryItemStatus.INACTIVE) {
        throw new InvalidInventoryStateError("Inventory item is inactive");
      }
      throw new InsufficientStockError(
        input.quantity,
        existing.availableQuantity,
      );
    }

    const item = await transaction.inventoryItem.findUniqueOrThrow({
      where: itemWhere(input),
    });

    const reservation = await transaction.inventoryReservation.create({
      data: {
        inventoryItemId: item.id,
        userId: input.userId,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        expiresAt: input.expiresAt,
      },
    });

    await transaction.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: InventoryMovementType.RESERVE,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: "Inventory reserved",
      },
    });

    const updatedItem = await transaction.inventoryItem.update({
      where: { id: item.id },
      data: { status: statusFor(item) },
    });

    return {
      ...reservation,
      inventoryItem: updatedItem,
    };
  });
}

export const createReservation = reserveInventory;

export function getReservation(
  id: string,
): Promise<InventoryReservationWithItem | null> {
  return prisma.inventoryReservation.findUnique({
    where: { id },
    include: { inventoryItem: true },
  });
}

export function getActiveReservation(
  id: string,
): Promise<InventoryReservationWithItem | null> {
  return prisma.inventoryReservation.findFirst({
    where: {
      id,
      status: InventoryReservationStatus.RESERVED,
      expiresAt: { gt: new Date() },
    },
    include: { inventoryItem: true },
  });
}

async function transitionReservation(
  reservationId: string,
  userId?: string,
  targetStatus: "CONFIRMED" | "RELEASED" | "EXPIRED" = "CONFIRMED",
  movementType: "SALE" | "RELEASE" = "SALE",
  reference: InventoryMutationReference = {},
): Promise<InventoryReservationWithItem> {
  return prisma.$transaction(async (transaction) => {
    const reservation = await transaction.inventoryReservation.findUnique({
      where: { id: reservationId },
      include: { inventoryItem: true },
    });

    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }
    if (reservation.status !== InventoryReservationStatus.RESERVED) {
      if (reservation.status === InventoryReservationStatus.CONFIRMED) {
        throw new ReservationAlreadyConfirmedError(reservationId);
      }
      throw new ReservationAlreadyReleasedError(reservationId);
    }
    if (userId && reservation.userId !== userId) {
      throw new InvalidInventoryStateError(
        "Inventory reservation does not belong to this user",
      );
    }
    if (
      targetStatus === InventoryReservationStatus.CONFIRMED &&
      reservation.expiresAt <= new Date()
    ) {
      throw new InvalidInventoryStateError("Inventory reservation has expired");
    }
    if (
      targetStatus === InventoryReservationStatus.EXPIRED &&
      reservation.expiresAt > new Date()
    ) {
      throw new InvalidInventoryStateError(
        "Inventory reservation has not expired",
      );
    }

    const itemUpdate =
      targetStatus === InventoryReservationStatus.CONFIRMED
        ? {
            reservedQuantity: { decrement: reservation.quantity },
            soldQuantity: { increment: reservation.quantity },
            version: { increment: 1 },
          }
        : {
            availableQuantity: { increment: reservation.quantity },
            reservedQuantity: { decrement: reservation.quantity },
            version: { increment: 1 },
          };

    const transitioned = await transaction.inventoryReservation.updateMany({
      where: {
        id: reservationId,
        ...(userId ? { userId } : {}),
        status: InventoryReservationStatus.RESERVED,
        ...(targetStatus === InventoryReservationStatus.CONFIRMED
          ? { expiresAt: { gt: new Date() } }
          : targetStatus === InventoryReservationStatus.EXPIRED
            ? { expiresAt: { lte: new Date() } }
            : {}),
      },
      data: { status: targetStatus },
    });
    if (transitioned.count !== 1) {
      throw new Error("Inventory reservation is no longer active");
    }

    const item = await transaction.inventoryItem.update({
      where: { id: reservation.inventoryItemId },
      data: itemUpdate,
    });
    const updatedItem = await transaction.inventoryItem.update({
      where: { id: item.id },
      data: { status: statusFor(item) },
    });
    const updatedReservation =
      await transaction.inventoryReservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { inventoryItem: true },
      });

    await transaction.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: movementType,
        quantity: reservation.quantity,
        referenceType: reference.referenceType ?? reservation.referenceType,
        referenceId: reference.referenceId ?? reservation.referenceId,
        reason: reference.reason ?? `Reservation ${targetStatus.toLowerCase()}`,
        metadata: reference.metadata,
      },
    });

    return { ...updatedReservation, inventoryItem: updatedItem };
  });
}

export function confirmInventoryReservation(
  reservationId: string,
  userId?: string,
  reference: InventoryMutationReference = {},
): Promise<InventoryReservationWithItem> {
  return transitionReservation(
    reservationId,
    userId,
    InventoryReservationStatus.CONFIRMED,
    InventoryMovementType.SALE,
    reference,
  );
}

export function releaseInventoryReservation(
  reservationId: string,
  userId?: string,
  reference: InventoryMutationReference = {},
): Promise<InventoryReservationWithItem> {
  return transitionReservation(
    reservationId,
    userId,
    InventoryReservationStatus.RELEASED,
    InventoryMovementType.RELEASE,
    reference,
  );
}

export function expireInventoryReservation(
  reservationId: string,
  userId?: string,
  reference: InventoryMutationReference = {},
): Promise<InventoryReservationWithItem> {
  return transitionReservation(
    reservationId,
    userId,
    InventoryReservationStatus.EXPIRED,
    InventoryMovementType.RELEASE,
    reference,
  );
}

/**
 * Sweeps and atomically expires stale reservations that have passed their expiration timestamp.
 * Returns stock to availableQuantity and records RELEASE ledger entries.
 */
export async function expireStaleReservations(
  batchSize = 100,
): Promise<InventoryReservationWithItem[]> {
  const expiredList: InventoryReservationWithItem[] = [];
  const now = new Date();

  const staleReservations = await prisma.inventoryReservation.findMany({
    where: {
      status: InventoryReservationStatus.RESERVED,
      expiresAt: { lte: now },
    },
    take: Math.min(Math.max(batchSize, 1), 500),
  });

  for (const stale of staleReservations) {
    try {
      const result = await expireInventoryReservation(stale.id, stale.userId, {
        reason: "Automatic expiration of abandoned reservation",
      });
      expiredList.push(result);
    } catch {
      // Stale reservation was concurrently processed or updated
    }
  }

  return expiredList;
}

/**
 * Confirms active reservations associated with a reference ID (e.g. Stripe checkout session) or reservation ID.
 * Converts reserved stock to sold stock and records SALE movements.
 */
export async function confirmReservationsByReference(
  referenceId: string,
  userId?: string,
): Promise<InventoryReservationWithItem[]> {
  const matching = await prisma.inventoryReservation.findMany({
    where: {
      status: InventoryReservationStatus.RESERVED,
      OR: [{ id: referenceId }, { referenceId }],
      ...(userId ? { userId } : {}),
    },
  });

  const confirmed: InventoryReservationWithItem[] = [];
  for (const reservation of matching) {
    try {
      const result = await confirmInventoryReservation(
        reservation.id,
        reservation.userId,
        {
          referenceType: "STRIPE_CHECKOUT",
          referenceId,
          reason: `Payment confirmed via checkout reference ${referenceId}`,
        },
      );
      confirmed.push(result);
    } catch {
      // Reservation might have been concurrently expired or already confirmed
    }
  }

  return confirmed;
}

/**
 * Releases active reservations associated with a reference ID or reservation ID.
 * Returns reserved stock to availableQuantity and records RELEASE movements.
 */
export async function releaseReservationsByReference(
  referenceId: string,
  userId?: string,
  reason = "Saga compensation release",
): Promise<InventoryReservationWithItem[]> {
  const matching = await prisma.inventoryReservation.findMany({
    where: {
      status: InventoryReservationStatus.RESERVED,
      OR: [{ id: referenceId }, { referenceId }],
      ...(userId ? { userId } : {}),
    },
  });

  const released: InventoryReservationWithItem[] = [];
  for (const reservation of matching) {
    try {
      const result = await releaseInventoryReservation(
        reservation.id,
        reservation.userId,
        {
          referenceType: "SAGA_COMPENSATION",
          referenceId,
          reason,
        },
      );
      released.push(result);
    } catch {
      // Reservation might have been concurrently expired or released
    }
  }

  return released;
}

export async function restockInventory(
  key: InventoryItemKey,
  quantity: number,
  reference: InventoryMutationReference = {},
): Promise<InventoryItem> {
  assertPositiveQuantity(quantity);
  return adjustInventory(
    key,
    quantity,
    InventoryMovementType.RESTOCK,
    reference,
  );
}

/**
 * Adjusts inventory quantity with atomic updates and complete audit ledger logging.
 * Negative quantityDelta decrements stock conditionally to strictly prevent negative quantities.
 */
export async function adjustInventory(
  key: InventoryItemKey,
  quantityDelta: number,
  movementType: InventoryMovementType = InventoryMovementType.ADJUSTMENT,
  reference: InventoryMutationReference = {},
): Promise<InventoryItem> {
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    throw new Error("Inventory adjustment must be a non-zero integer");
  }

  return prisma.$transaction(async (transaction) => {
    if (quantityDelta < 0) {
      const deduction = Math.abs(quantityDelta);
      const updated = await transaction.inventoryItem.updateMany({
        where: {
          ...itemWhere(key),
          availableQuantity: { gte: deduction },
          quantity: { gte: deduction },
        },
        data: {
          quantity: { decrement: deduction },
          availableQuantity: { decrement: deduction },
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        const item = await transaction.inventoryItem.findUnique({
          where: itemWhere(key),
        });
        if (!item) {
          throw new InventoryNotFoundError(
            `Product ${key.productId}, Variant ${key.variantId}, Warehouse ${key.warehouseId}`,
          );
        }
        throw new InsufficientStockError(deduction, item.availableQuantity);
      }
    } else {
      const addition = quantityDelta;
      const updated = await transaction.inventoryItem.updateMany({
        where: itemWhere(key),
        data: {
          quantity: { increment: addition },
          availableQuantity: { increment: addition },
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new InventoryNotFoundError(
          `Product ${key.productId}, Variant ${key.variantId}, Warehouse ${key.warehouseId}`,
        );
      }
    }

    const item = await transaction.inventoryItem.findUniqueOrThrow({
      where: itemWhere(key),
    });

    const updatedItem = await transaction.inventoryItem.update({
      where: { id: item.id },
      data: { status: statusFor(item) },
    });

    await transaction.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: movementType,
        quantity: Math.abs(quantityDelta),
        referenceType: reference.referenceType,
        referenceId: reference.referenceId,
        reason: reference.reason,
        metadata: reference.metadata,
      },
    });

    return updatedItem;
  });
}

/**
 * Atomically transfers stock between two warehouses in a single transaction.
 * Deducts from source and increments destination, logging TRANSFER_OUT and TRANSFER_IN ledger records.
 */
export async function transferInventory(
  input: TransferInventoryInput,
): Promise<TransferInventoryResult> {
  assertPositiveQuantity(input.quantity);
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new InvalidInventoryStateError(
      "Source and destination warehouses cannot be the same",
    );
  }

  return prisma.$transaction(async (transaction) => {
    // 1. Ensure destination warehouse exists
    const destWarehouse = await transaction.warehouse.findUnique({
      where: { id: input.toWarehouseId },
    });
    if (!destWarehouse) {
      await transaction.warehouse.create({
        data: {
          id: input.toWarehouseId,
          name: `Warehouse ${input.toWarehouseId}`,
          code: input.toWarehouseId.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
          status: WarehouseStatus.ACTIVE,
        },
      });
    }

    // 2. Atomic conditional decrement from source warehouse
    const sourceUpdated = await transaction.inventoryItem.updateMany({
      where: {
        productId: input.productId,
        variantId: input.variantId,
        warehouseId: input.fromWarehouseId,
        status: { not: InventoryItemStatus.INACTIVE },
        availableQuantity: { gte: input.quantity },
        quantity: { gte: input.quantity },
      },
      data: {
        quantity: { decrement: input.quantity },
        availableQuantity: { decrement: input.quantity },
        version: { increment: 1 },
      },
    });

    if (sourceUpdated.count !== 1) {
      const existing = await transaction.inventoryItem.findUnique({
        where: itemWhere({
          productId: input.productId,
          variantId: input.variantId,
          warehouseId: input.fromWarehouseId,
        }),
      });
      if (!existing) {
        throw new InventoryNotFoundError(
          `Product ${input.productId}, Variant ${input.variantId}, Warehouse ${input.fromWarehouseId}`,
        );
      }
      if (existing.status === InventoryItemStatus.INACTIVE) {
        throw new InvalidInventoryStateError(
          "Source inventory item is inactive",
        );
      }
      throw new InsufficientStockError(
        input.quantity,
        existing.availableQuantity,
      );
    }

    const fromItem = await transaction.inventoryItem.findUniqueOrThrow({
      where: itemWhere({
        productId: input.productId,
        variantId: input.variantId,
        warehouseId: input.fromWarehouseId,
      }),
    });

    const updatedFromItem = await transaction.inventoryItem.update({
      where: { id: fromItem.id },
      data: { status: statusFor(fromItem) },
    });

    // 3. Increment or create destination warehouse inventory item
    let toItem = await transaction.inventoryItem.findUnique({
      where: itemWhere({
        productId: input.productId,
        variantId: input.variantId,
        warehouseId: input.toWarehouseId,
      }),
    });

    if (!toItem) {
      toItem = await transaction.inventoryItem.create({
        data: {
          productId: input.productId,
          variantId: input.variantId,
          warehouseId: input.toWarehouseId,
          quantity: input.quantity,
          availableQuantity: input.quantity,
          reorderPoint: fromItem.reorderPoint,
          status: InventoryItemStatus.ACTIVE,
        },
      });
    } else {
      toItem = await transaction.inventoryItem.update({
        where: { id: toItem.id },
        data: {
          quantity: { increment: input.quantity },
          availableQuantity: { increment: input.quantity },
          version: { increment: 1 },
          status: InventoryItemStatus.ACTIVE,
        },
      });
    }

    const transferRef = input.referenceId ?? `xfer_${Date.now()}`;

    // 4. Record TRANSFER_OUT movement for source item
    const outMovement = await transaction.inventoryMovement.create({
      data: {
        inventoryItemId: fromItem.id,
        type: InventoryMovementType.TRANSFER_OUT,
        quantity: input.quantity,
        referenceType: input.referenceType ?? "WAREHOUSE_TRANSFER",
        referenceId: transferRef,
        reason: input.reason ?? `Transfer to warehouse ${input.toWarehouseId}`,
        metadata: (input.metadata ?? {
          destinationWarehouseId: input.toWarehouseId,
          destinationItemId: toItem.id,
        }) as Prisma.InputJsonValue,
      },
    });

    // 5. Record TRANSFER_IN movement for destination item
    const inMovement = await transaction.inventoryMovement.create({
      data: {
        inventoryItemId: toItem.id,
        type: InventoryMovementType.TRANSFER_IN,
        quantity: input.quantity,
        referenceType: input.referenceType ?? "WAREHOUSE_TRANSFER",
        referenceId: transferRef,
        reason:
          input.reason ?? `Transfer from warehouse ${input.fromWarehouseId}`,
        metadata: (input.metadata ?? {
          sourceWarehouseId: input.fromWarehouseId,
          sourceItemId: fromItem.id,
        }) as Prisma.InputJsonValue,
      },
    });

    return {
      fromItem: updatedFromItem,
      toItem,
      outMovement,
      inMovement,
    };
  });
}

/**
 * Creates an immutable movement record directly in the audit ledger.
 */
export function createMovement(
  input: CreateMovementInput,
): Promise<InventoryMovement> {
  assertPositiveQuantity(input.quantity);
  return prisma.inventoryMovement.create({
    data: {
      inventoryItemId: input.inventoryItemId,
      type: input.type,
      quantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      reason: input.reason,
      metadata: input.metadata,
    },
  });
}

/**
 * Lists movements for a specific item identified by composite key.
 */
export function listInventoryMovements(
  key: InventoryItemKey,
  options: { limit?: number; cursor?: string } = {},
): Promise<InventoryMovementWithItem[]> {
  return prisma.inventoryMovement.findMany({
    where: { inventoryItem: itemWhere(key) },
    include: { inventoryItem: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options.limit ?? 50, 1), 100),
    ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
  });
}

/**
 * Flexible movement query allowing filtration across product, variant, warehouse, or type.
 */
export function listMovements(
  filter: MovementFilter = {},
): Promise<InventoryMovementWithItem[]> {
  const where: Prisma.InventoryMovementWhereInput = {};
  if (
    filter.productId !== undefined ||
    filter.variantId ||
    filter.warehouseId
  ) {
    where.inventoryItem = {
      ...(filter.productId !== undefined
        ? { productId: filter.productId }
        : {}),
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    };
  }
  if (filter.type) {
    where.type = filter.type;
  }

  return prisma.inventoryMovement.findMany({
    where,
    include: { inventoryItem: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(filter.limit ?? 50, 1), 500),
    ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
  });
}

export const getMovements = listMovements;

export function listLowStockInventory(limit = 100): Promise<InventoryItem[]> {
  return prisma.inventoryItem.findMany({
    where: {
      status: {
        in: [InventoryItemStatus.LOW_STOCK, InventoryItemStatus.OUT_OF_STOCK],
      },
    },
    include: { warehouse: true },
    orderBy: [{ status: "desc" }, { availableQuantity: "asc" }],
    take: Math.min(Math.max(limit, 1), 500),
  });
}

export function listInventoryItems(
  lookup: InventoryLookup,
): Promise<InventoryItem[]> {
  return prisma.inventoryItem.findMany({
    where: {
      productId: lookup.productId,
      ...(lookup.variantId ? { variantId: lookup.variantId } : {}),
      ...(lookup.warehouseId ? { warehouseId: lookup.warehouseId } : {}),
    },
    include: { warehouse: true },
    orderBy: { warehouseId: "asc" },
  });
}

export function listAllInventoryItems(
  filter: {
    productId?: number;
    variantId?: string;
    warehouseId?: string;
    status?: InventoryItemStatus;
    limit?: number;
  } = {},
): Promise<InventoryItem[]> {
  return prisma.inventoryItem.findMany({
    where: {
      ...(filter.productId !== undefined
        ? { productId: filter.productId }
        : {}),
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    include: { warehouse: true },
    orderBy: [{ productId: "asc" }, { warehouseId: "asc" }],
    take: Math.min(Math.max(filter.limit ?? 100, 1), 500),
  });
}

/**
 * Creates a warehouse record.
 */
export async function createWarehouse(
  input: CreateWarehouseInput,
): Promise<Warehouse> {
  return prisma.warehouse.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      name: input.name,
      code: input.code,
      status: input.status ?? WarehouseStatus.ACTIVE,
      address: input.address,
    },
  });
}

/**
 * Retrieves a warehouse by ID or unique code.
 */
export async function getWarehouse(
  idOrCode: string,
): Promise<Warehouse | null> {
  const warehouse = await prisma.warehouse.findFirst({
    where: {
      OR: [{ id: idOrCode }, { code: idOrCode }],
    },
  });
  return warehouse;
}

/**
 * Retrieves a warehouse by ID or unique code, throwing WarehouseNotFoundError if missing.
 */
export async function getWarehouseOrThrow(
  idOrCode: string,
): Promise<Warehouse> {
  const warehouse = await getWarehouse(idOrCode);
  if (!warehouse) {
    throw new WarehouseNotFoundError(idOrCode);
  }
  return warehouse;
}

/**
 * Lists warehouses with optional status filtration.
 */
export function listWarehouses(
  filter: { status?: WarehouseStatus } = {},
): Promise<Warehouse[]> {
  return prisma.warehouse.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryReservationStatus,
  WarehouseStatus,
};
