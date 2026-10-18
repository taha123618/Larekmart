import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";
import { returnShipments } from "../db/schema.js";

export interface CreateShipmentData {
  returnId: string;
  carrierName: string;
  trackingNumber: string;
  labelUrl?: string;
  isPrepaid: boolean;
  paidBy: string;
  shippingFee: string;
  trackingStatus?: string;
}

export class ShipmentRepository {
  private db = getDb();

  async createShipment(data: CreateShipmentData): Promise<string> {
    const id = uuidv4();
    await this.db.insert(returnShipments).values({
      id,
      returnId: data.returnId,
      carrierName: data.carrierName,
      trackingNumber: data.trackingNumber,
      labelUrl: data.labelUrl || null,
      isPrepaid: data.isPrepaid,
      paidBy: data.paidBy,
      shippingFee: data.shippingFee,
      trackingStatus: data.trackingStatus || "LABEL_CREATED",
    });
    return id;
  }

  async findByReturnId(returnId: string) {
    return this.db
      .select()
      .from(returnShipments)
      .where(eq(returnShipments.returnId, returnId));
  }

  async updateTrackingStatus(
    returnId: string,
    status: string,
    timestamps?: { shippedAt?: Date; deliveredAt?: Date },
  ) {
    await this.db
      .update(returnShipments)
      .set({
        trackingStatus: status,
        shippedAt: timestamps?.shippedAt || undefined,
        deliveredAt: timestamps?.deliveredAt || undefined,
      })
      .where(eq(returnShipments.returnId, returnId));
  }
}

export const shipmentRepository = new ShipmentRepository();
