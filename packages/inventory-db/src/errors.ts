/**
 * Custom Domain / Database Errors for @repo/inventory-db.
 *
 * These typed error classes allow inventory-service and other consuming services
 * to handle domain-level inventory failures cleanly without parsing raw Prisma errors.
 */

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InventoryNotFoundError extends InventoryError {
  constructor(identifier?: string) {
    super(
      identifier
        ? `Inventory item not found: ${identifier}`
        : "Inventory item not found",
    );
    this.name = "InventoryNotFoundError";
  }
}

export class InsufficientStockError extends InventoryError {
  public readonly requested: number;
  public readonly available: number;

  constructor(requested: number, available: number) {
    super(
      `Insufficient inventory: requested ${requested}, but only ${available} available`,
    );
    this.name = "InsufficientStockError";
    this.requested = requested;
    this.available = available;
  }
}

export class ReservationNotFoundError extends InventoryError {
  constructor(reservationId?: string) {
    super(
      reservationId
        ? `Inventory reservation not found: ${reservationId}`
        : "Inventory reservation not found",
    );
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationAlreadyConfirmedError extends InventoryError {
  constructor(reservationId: string) {
    super(`Inventory reservation ${reservationId} has already been confirmed`);
    this.name = "ReservationAlreadyConfirmedError";
  }
}

export class ReservationAlreadyReleasedError extends InventoryError {
  constructor(reservationId: string) {
    super(
      `Inventory reservation ${reservationId} has already been released or expired`,
    );
    this.name = "ReservationAlreadyReleasedError";
  }
}

export class DuplicateReservationError extends InventoryError {
  constructor(reference: string) {
    super(`Duplicate inventory reservation for reference: ${reference}`);
    this.name = "DuplicateReservationError";
  }
}

export class WarehouseNotFoundError extends InventoryError {
  constructor(warehouseId?: string) {
    super(
      warehouseId
        ? `Warehouse not found: ${warehouseId}`
        : "Warehouse not found",
    );
    this.name = "WarehouseNotFoundError";
  }
}

export class InvalidInventoryStateError extends InventoryError {
  constructor(message: string) {
    super(`Invalid inventory state: ${message}`);
    this.name = "InvalidInventoryStateError";
  }
}
