import { policyRepository } from "../repositories/policy.repository.js";

export interface EligibilityInput {
  deliveredAt: Date | string | null;
  reasonId: string;
  hasEvidence: boolean;
  orderStatus?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  autoApprove: boolean;
  requiresManualReview: boolean;
  rejectionReason?: string;
  policyVersion: string;
}

export class EligibilityService {
  async evaluateEligibility(input: EligibilityInput): Promise<EligibilityResult> {
    const policy = await policyRepository.getActivePolicy();
    const policyVersion = policy?.version || "1.0.0";
    const returnWindowDays = policy?.returnWindowDays ?? 14;
    const warrantyGraceDays = policy?.warrantyGraceDays ?? 30;

    const reason = await policyRepository.getReasonById(input.reasonId);
    if (!reason || !reason.isActive) {
      return {
        eligible: false,
        autoApprove: false,
        requiresManualReview: false,
        rejectionReason: `Return reason '${input.reasonId}' is invalid or no longer accepted.`,
        policyVersion,
      };
    }

    // 1. Delivery Date Check
    if (!input.deliveredAt) {
      return {
        eligible: false,
        autoApprove: false,
        requiresManualReview: false,
        rejectionReason: "Order items can only be returned after delivery.",
        policyVersion,
      };
    }

    const deliveredDate = new Date(input.deliveredAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - deliveredDate.getTime());
    const daysSinceDelivery = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Defective/damaged seller-fault items get warrantyGraceDays (30 days); buyer remorse gets returnWindowDays (14 days)
    const allowedDays = reason.isSellerFault ? warrantyGraceDays : returnWindowDays;

    if (daysSinceDelivery > allowedDays) {
      return {
        eligible: false,
        autoApprove: false,
        requiresManualReview: false,
        rejectionReason: `Return window expired. Orders with reason '${reason.title}' must be requested within ${allowedDays} days of delivery (delivered ${daysSinceDelivery} days ago).`,
        policyVersion,
      };
    }

    // 2. Evidence Requirements Check
    if (reason.requiresEvidence && !input.hasEvidence) {
      return {
        eligible: false,
        autoApprove: false,
        requiresManualReview: true,
        rejectionReason: `Evidence (photos/videos) is required for '${reason.title}'. Please attach evidence to proceed.`,
        policyVersion,
      };
    }

    // 3. Hybrid Approval Logic:
    // If reason requires evidence or is seller fault -> route to PENDING_REVIEW (manual review)
    // If standard buyer remorse within window -> autoApprove
    const autoApprove = !reason.requiresEvidence && !reason.isSellerFault;
    const requiresManualReview = !autoApprove;

    return {
      eligible: true,
      autoApprove,
      requiresManualReview,
      policyVersion,
    };
  }
}

export const eligibilityService = new EligibilityService();
