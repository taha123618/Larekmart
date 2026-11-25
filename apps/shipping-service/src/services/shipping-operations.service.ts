import { z } from "zod";

export type DeliveryAttemptOutcome =
  | "DELIVERED"
  | "FAILED_RECIPIENT_UNAVAILABLE"
  | "FAILED_ADDRESS_ISSUE"
  | "FAILED_REFUSED";

export interface DeliveryAttemptRecord {
  attemptId: string;
  shipmentId: string;
  carrier: string;
  attemptNumber: number;
  outcome: DeliveryAttemptOutcome;
  notes?: string;
  nextAction: "COMPLETED" | "RETRY_SCHEDULED" | "RETURN_TO_ORIGIN";
  nextAttemptAt?: string;
  recordedAt: string;
}

export interface ReturnPickupRecord {
  pickupId: string;
  returnId: string;
  orderId: string;
  carrier: string;
  pickupAddress: string;
  status: "SCHEDULED" | "PICKED_UP" | "DELIVERED_TO_WAREHOUSE" | "CANCELLED";
  scheduledDate: string;
  updatedAt: string;
}

export const DeliveryAttemptSchema = z.object({
  carrier: z.string().min(2).max(32),
  outcome: z.enum([
    "DELIVERED",
    "FAILED_RECIPIENT_UNAVAILABLE",
    "FAILED_ADDRESS_ISSUE",
    "FAILED_REFUSED",
  ]),
  notes: z.string().max(500).optional(),
  transitHours: z.number().positive().optional(),
});

export const ReturnPickupSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  carrier: z.string().min(2).max(32),
  pickupAddress: z.string().min(5).max(500),
  scheduledDate: z.string().min(4),
});

export const ReturnPickupStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "PICKED_UP", "DELIVERED_TO_WAREHOUSE", "CANCELLED"]),
});

const attemptLedger = new Map<string, DeliveryAttemptRecord[]>();
const returnPickupStore = new Map<string, ReturnPickupRecord>();

const MAX_DELIVERY_ATTEMPTS = 3;

export function recordDeliveryAttempt(
  shipmentId: string,
  input: z.infer<typeof DeliveryAttemptSchema>,
): DeliveryAttemptRecord {
  const existing = attemptLedger.get(shipmentId) ?? [];
  const attemptNumber = existing.length + 1;

  let nextAction: DeliveryAttemptRecord["nextAction"] = "COMPLETED";
  let nextAttemptAt: string | undefined;

  if (input.outcome !== "DELIVERED") {
    if (input.outcome === "FAILED_REFUSED" || attemptNumber >= MAX_DELIVERY_ATTEMPTS) {
      nextAction = "RETURN_TO_ORIGIN";
    } else {
      nextAction = "RETRY_SCHEDULED";
      nextAttemptAt = new Date(Date.now() + 24 * 3600_000).toISOString();
    }
  }

  const record: DeliveryAttemptRecord = {
    attemptId: `att_${crypto.randomUUID().slice(0, 12)}`,
    shipmentId,
    carrier: input.carrier.toUpperCase(),
    attemptNumber,
    outcome: input.outcome,
    notes: input.notes,
    nextAction,
    nextAttemptAt,
    recordedAt: new Date().toISOString(),
  };

  existing.push(record);
  attemptLedger.set(shipmentId, existing);
  return record;
}

export function getShipmentAttempts(shipmentId: string): DeliveryAttemptRecord[] {
  return attemptLedger.get(shipmentId) ?? [];
}

export function getCourierPerformanceMetrics() {
  const byCarrier = new Map<
    string,
    { totalAttempts: number; delivered: number; firstAttemptDelivered: number; rto: number }
  >();

  for (const attempts of attemptLedger.values()) {
    for (const att of attempts) {
      const curr = byCarrier.get(att.carrier) ?? {
        totalAttempts: 0,
        delivered: 0,
        firstAttemptDelivered: 0,
        rto: 0,
      };
      curr.totalAttempts += 1;
      if (att.outcome === "DELIVERED") {
        curr.delivered += 1;
        if (att.attemptNumber === 1) curr.firstAttemptDelivered += 1;
      }
      if (att.nextAction === "RETURN_TO_ORIGIN") {
        curr.rto += 1;
      }
      byCarrier.set(att.carrier, curr);
    }
  }

  return Array.from(byCarrier.entries()).map(([carrier, stats]) => ({
    carrier,
    totalAttempts: stats.totalAttempts,
    deliveredCount: stats.delivered,
    firstAttemptSuccessRate:
      stats.totalAttempts > 0
        ? Number(((stats.firstAttemptDelivered / stats.totalAttempts) * 100).toFixed(2))
        : 0,
    rtoCount: stats.rto,
  }));
}

export function scheduleReturnPickup(
  input: z.infer<typeof ReturnPickupSchema>,
): ReturnPickupRecord {
  const record: ReturnPickupRecord = {
    pickupId: `rpk_${crypto.randomUUID().slice(0, 12)}`,
    returnId: input.returnId,
    orderId: input.orderId,
    carrier: input.carrier.toUpperCase(),
    pickupAddress: input.pickupAddress,
    status: "SCHEDULED",
    scheduledDate: input.scheduledDate,
    updatedAt: new Date().toISOString(),
  };
  returnPickupStore.set(record.pickupId, record);
  return record;
}

export function updateReturnPickupStatus(
  pickupId: string,
  status: ReturnPickupRecord["status"],
): ReturnPickupRecord {
  const existing = returnPickupStore.get(pickupId);
  if (!existing) {
    throw new Error(`Return pickup ${pickupId} not found`);
  }
  existing.status = status;
  existing.updatedAt = new Date().toISOString();
  returnPickupStore.set(pickupId, existing);
  return existing;
}
