import { z } from "zod";

export interface StaffAuditLogEntry {
  auditId: string;
  sellerId: string;
  actorId: string;
  action: string;
  targetUserId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SellerSlaScorecard {
  sellerId: string;
  fulfillmentSlaTargetHours: number;
  actualAvgFulfillmentHours: number;
  responseSlaTargetMinutes: number;
  actualAvgResponseMinutes: number;
  onTimeDispatchRate: number;
  orderDefectRate: number;
  storeHealthGrade: "EXCELLENT" | "GOOD" | "AT_RISK" | "CRITICAL";
  vacationMode: boolean;
  calculatedAt: string;
}

export const SlaScorecardInputSchema = z.object({
  actualAvgFulfillmentHours: z.number().nonnegative(),
  actualAvgResponseMinutes: z.number().nonnegative(),
  onTimeDispatchRate: z.number().min(0).max(100),
  orderDefectRate: z.number().min(0).max(100),
  vacationMode: z.boolean().default(false),
});

export const StaffAuditInputSchema = z.object({
  action: z.string().min(2).max(128),
  targetUserId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});

const auditLogs = new Map<string, StaffAuditLogEntry[]>();

export function computeSellerSlaScorecard(
  sellerId: string,
  input: z.infer<typeof SlaScorecardInputSchema>,
): SellerSlaScorecard {
  let storeHealthGrade: SellerSlaScorecard["storeHealthGrade"] = "EXCELLENT";
  if (input.orderDefectRate >= 2.5 || input.onTimeDispatchRate < 85) {
    storeHealthGrade = "CRITICAL";
  } else if (input.orderDefectRate >= 1.0 || input.onTimeDispatchRate < 95) {
    storeHealthGrade = "AT_RISK";
  } else if (input.actualAvgFulfillmentHours > 24 || input.actualAvgResponseMinutes > 60) {
    storeHealthGrade = "GOOD";
  }

  return {
    sellerId,
    fulfillmentSlaTargetHours: 24,
    actualAvgFulfillmentHours: input.actualAvgFulfillmentHours,
    responseSlaTargetMinutes: 60,
    actualAvgResponseMinutes: input.actualAvgResponseMinutes,
    onTimeDispatchRate: input.onTimeDispatchRate,
    orderDefectRate: input.orderDefectRate,
    storeHealthGrade,
    vacationMode: input.vacationMode,
    calculatedAt: new Date().toISOString(),
  };
}

export function recordStaffAuditEvent(
  sellerId: string,
  actorId: string,
  input: z.infer<typeof StaffAuditInputSchema>,
): StaffAuditLogEntry {
  const entry: StaffAuditLogEntry = {
    auditId: `saud_${crypto.randomUUID().slice(0, 12)}`,
    sellerId,
    actorId,
    action: input.action,
    targetUserId: input.targetUserId,
    details: input.details,
    createdAt: new Date().toISOString(),
  };
  const existing = auditLogs.get(sellerId) ?? [];
  existing.unshift(entry);
  auditLogs.set(sellerId, existing.slice(0, 200));
  return entry;
}

export function getStaffAuditLogs(sellerId: string): StaffAuditLogEntry[] {
  return auditLogs.get(sellerId) ?? [];
}
