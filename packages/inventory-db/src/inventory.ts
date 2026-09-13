import {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryReservationStatus,
  type InventoryItem,
  type InventoryMovement,
  type InventoryReservation,
  Prisma,
} from "../generated/prisma";
import { prisma } from "./client";

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

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Inventory quantity must be a positive integer");
  }
}

function statusFor(
  item: Pick<InventoryItem, "availableQuantity" | "reorderPoint">,
): InventoryItemStatus {
  if (item.availableQuantity === 0) return InventoryItemStatus.OUT_OF_STOCK;
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

  return prisma.inventoryItem.create({
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
}

export function getInventoryItem(
  key: InventoryItemKey,
): Promise<InventoryItem | null> {
  return prisma.inventoryItem.findUnique({ where: itemWhere(key) });
}

export async function reserveInventory(
  input: ReserveInventoryInput,
): Promise<InventoryReservationWithItem> {
  assertPositiveQuantity(input.quantity);
  if (input.expiresAt <= new Date()) {
    throw new Error("Inventory reservation must expire in the future");
  }

  return prisma.$transaction(async (transaction) => {
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
      throw new Error("Insufficient inventory or inventory item not found");
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

    await transaction.inventoryItem.update({
      where: { id: item.id },
      data: { status: statusFor(item) },
    });
    return {
      ...reservation,
      inventoryItem: { ...item, status: statusFor(item) },
    };
  });
}

async function transitionReservation(
  reservationId: string,
  userId: string,
  targetStatus: "CONFIRMED" | "RELEASED" | "EXPIRED",
  movementType: "SALE" | "RELEASE",
  reference: InventoryMutationReference,
): Promise<InventoryReservationWithItem> {
  return prisma.$transaction(async (transaction) => {
    const reservation = await transaction.inventoryReservation.findUnique({
      where: { id: reservationId },
      include: { inventoryItem: true },
    });

    if (
      !reservation ||
      reservation.status !== InventoryReservationStatus.RESERVED
    ) {
      throw new Error("Inventory reservation is not active");
    }
    if (
      targetStatus === InventoryReservationStatus.CONFIRMED &&
      reservation.expiresAt <= new Date()
    ) {
      throw new Error("Inventory reservation has expired");
    }
    if (
      targetStatus === InventoryReservationStatus.EXPIRED &&
      reservation.expiresAt > new Date()
    ) {
      throw new Error("Inventory reservation has not expired");
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
        userId,
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
        reason: reference.reason,
      },
    });

    return { ...updatedReservation, inventoryItem: updatedItem };
  });
}

export function confirmInventoryReservation(
  reservationId: string,
  userId: string,
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
  userId: string,
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
  userId: string,
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

export async function adjustInventory(
  key: InventoryItemKey,
  quantityDelta: number,
  movementType: "RESTOCK" | "ADJUSTMENT" | "DAMAGE",
  reference: InventoryMutationReference = {},
): Promise<InventoryItem> {
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    throw new Error("Inventory adjustment must be a non-zero integer");
  }

  return prisma.$transaction(async (transaction) => {
    const item = await transaction.inventoryItem.findUniqueOrThrow({
      where: itemWhere(key),
    });
    const nextQuantity = item.quantity + quantityDelta;
    const nextAvailable = item.availableQuantity + quantityDelta;
    if (nextQuantity < 0 || nextAvailable < 0) {
      throw new Error("Inventory adjustment cannot make stock negative");
    }

    const updated = await transaction.inventoryItem.update({
      where: { id: item.id, version: item.version },
      data: {
        quantity: nextQuantity,
        availableQuantity: nextAvailable,
        version: { increment: 1 },
        status: statusFor({
          availableQuantity: nextAvailable,
          reorderPoint: item.reorderPoint,
        }),
      },
    });
    await transaction.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: movementType,
        quantity: Math.abs(quantityDelta),
        referenceType: reference.referenceType,
        referenceId: reference.referenceId,
        reason: reference.reason,
      },
    });
    return updated;
  });
}

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

export function listLowStockInventory(limit = 100): Promise<InventoryItem[]> {
  return prisma.inventoryItem.findMany({
    where: {
      status: {
        in: [InventoryItemStatus.LOW_STOCK, InventoryItemStatus.OUT_OF_STOCK],
      },
    },
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
    orderBy: { warehouseId: "asc" },
  });
}

export {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryReservationStatus,
};
