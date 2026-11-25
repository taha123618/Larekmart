import { z } from "zod";

export interface PriceFloorRule {
  productId: string;
  minPrice: number;
  minMarginPercent: number;
  currency: string;
  updatedBy: string;
  updatedAt: string;
}

export interface PriceExperiment {
  experimentId: string;
  productId: string;
  controlPrice: number;
  variantPrice: number;
  trafficSplitPercent: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  controlViews: number;
  controlConversions: number;
  variantViews: number;
  variantConversions: number;
  createdAt: string;
}

export interface PriceApprovalRequest {
  requestId: string;
  items: Array<{ productId: string; proposedPrice: number; currentPrice: number }>;
  requestedBy: string;
  reason: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
}

export const PriceFloorSchema = z.object({
  productId: z.string().min(1),
  minPrice: z.number().nonnegative(),
  minMarginPercent: z.number().min(0).max(95).default(5),
  currency: z.string().min(3).max(8).default("USD"),
});

export const PriceExperimentSchema = z.object({
  productId: z.string().min(1),
  controlPrice: z.number().positive(),
  variantPrice: z.number().positive(),
  trafficSplitPercent: z.number().int().min(1).max(99).default(50),
});

export const BulkPriceApprovalSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        proposedPrice: z.number().positive(),
        currentPrice: z.number().positive(),
      }),
    )
    .min(1),
  reason: z.string().min(3).max(500),
});

const floorStore = new Map<string, PriceFloorRule>();
const experimentStore = new Map<string, PriceExperiment>();
const approvalStore = new Map<string, PriceApprovalRequest>();

export function setPriceFloor(
  input: z.infer<typeof PriceFloorSchema>,
  updatedBy: string,
): PriceFloorRule {
  const rule: PriceFloorRule = {
    ...input,
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
  floorStore.set(input.productId, rule);
  return rule;
}

export function validatePriceAgainstFloor(
  productId: string,
  proposedPrice: number,
  costBasis?: number,
): { allowed: boolean; reason?: string; floor?: PriceFloorRule } {
  const floor = floorStore.get(productId);
  if (!floor) return { allowed: true };

  if (proposedPrice < floor.minPrice) {
    return {
      allowed: false,
      reason: `Proposed price ${proposedPrice} is below configured floor ${floor.minPrice}`,
      floor,
    };
  }

  if (costBasis !== undefined && costBasis > 0) {
    const marginPercent = ((proposedPrice - costBasis) / proposedPrice) * 100;
    if (marginPercent < floor.minMarginPercent) {
      return {
        allowed: false,
        reason: `Margin ${marginPercent.toFixed(2)}% is below minimum ${floor.minMarginPercent}%`,
        floor,
      };
    }
  }

  return { allowed: true, floor };
}

export function createPriceExperiment(
  input: z.infer<typeof PriceExperimentSchema>,
): PriceExperiment {
  const floorCheck = validatePriceAgainstFloor(input.productId, input.variantPrice);
  if (!floorCheck.allowed) {
    throw new Error(floorCheck.reason || "Variant price violates price floor");
  }
  const exp: PriceExperiment = {
    experimentId: `pexp_${crypto.randomUUID().slice(0, 12)}`,
    productId: input.productId,
    controlPrice: input.controlPrice,
    variantPrice: input.variantPrice,
    trafficSplitPercent: input.trafficSplitPercent,
    status: "ACTIVE",
    controlViews: 0,
    controlConversions: 0,
    variantViews: 0,
    variantConversions: 0,
    createdAt: new Date().toISOString(),
  };
  experimentStore.set(exp.experimentId, exp);
  return exp;
}

export function assignExperimentPrice(
  experimentId: string,
  bucketSeed: string,
): { bucket: "CONTROL" | "VARIANT"; price: number } {
  const exp = experimentStore.get(experimentId);
  if (!exp) throw new Error(`Experiment ${experimentId} not found`);

  let hash = 0;
  for (let i = 0; i < bucketSeed.length; i++) {
    hash = (hash * 31 + bucketSeed.charCodeAt(i)) % 100;
  }
  const bucket = Math.abs(hash) < exp.trafficSplitPercent ? "VARIANT" : "CONTROL";
  if (bucket === "VARIANT") exp.variantViews += 1;
  else exp.controlViews += 1;

  return {
    bucket,
    price: bucket === "VARIANT" ? exp.variantPrice : exp.controlPrice,
  };
}

export function submitBulkPriceApproval(
  input: z.infer<typeof BulkPriceApprovalSchema>,
  requestedBy: string,
): PriceApprovalRequest {
  for (const item of input.items) {
    const check = validatePriceAgainstFloor(item.productId, item.proposedPrice);
    if (!check.allowed) {
      throw new Error(`Product ${item.productId}: ${check.reason}`);
    }
  }

  const req: PriceApprovalRequest = {
    requestId: `papp_${crypto.randomUUID().slice(0, 12)}`,
    items: input.items,
    requestedBy,
    reason: input.reason,
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
  };
  approvalStore.set(req.requestId, req);
  return req;
}

export function reviewPriceApproval(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  reviewedBy: string,
  reviewNotes?: string,
): PriceApprovalRequest {
  const req = approvalStore.get(requestId);
  if (!req) throw new Error(`Approval request ${requestId} not found`);
  req.status = decision;
  req.reviewedBy = reviewedBy;
  req.reviewNotes = reviewNotes;
  req.reviewedAt = new Date().toISOString();
  approvalStore.set(requestId, req);
  return req;
}
