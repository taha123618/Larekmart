import { ReturnStatusEnum, ReturnStatus } from "@repo/types";
import { returnRepository } from "../repositories/return.repository.js";
import { policyRepository } from "../repositories/policy.repository.js";
import { shipmentRepository } from "../repositories/shipment.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { eligibilityService } from "./eligibility.service.js";
import { prorationService, ItemProrationInput } from "./proration.service.js";
import { ReturnStateMachine } from "./state-machine.js";

export interface CreateReturnInput {
  orderId: string;
  sellerId?: string;
  items: Array<{
    orderItemId: string;
    productId: string;
    variantId?: string;
    quantity: number;
    originalQuantity?: number;
    unitPrice?: string | number;
    itemDiscount?: string | number;
    taxAmount?: string | number;
    reason: string;
    condition?: string;
    customerNote?: string;
  }>;
  evidenceMediaIds?: string[];
  evidenceMedia?: Array<{
    mediaId: string;
    url: string;
    mediaType?: string;
    caption?: string;
  }>;
  reasonCategory: string;
  customerComments?: string;
  deliveredAt?: Date | string | null;
}

export class ReturnService {
  async requestReturn(customerId: string, input: CreateReturnInput) {
    const hasEvidence =
      (input.evidenceMediaIds && input.evidenceMediaIds.length > 0) ||
      (input.evidenceMedia && input.evidenceMedia.length > 0) ||
      false;

    // 1. Evaluate eligibility
    const eligibility = await eligibilityService.evaluateEligibility({
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
      reasonId: input.reasonCategory,
      hasEvidence,
    });

    if (!eligibility.eligible && !eligibility.requiresManualReview) {
      throw new Error(
        eligibility.rejectionReason || "Order is not eligible for return.",
      );
    }

    // 2. Prorate refund amounts
    const prorationItems: ItemProrationInput[] = input.items.map((i) => ({
      orderItemId: i.orderItemId,
      productId: i.productId,
      variantId: i.variantId,
      returnedQuantity: i.quantity,
      originalQuantity: i.originalQuantity || i.quantity,
      unitPrice: i.unitPrice ?? "0.00",
      itemDiscount: i.itemDiscount ?? "0.00",
      taxAmount: i.taxAmount ?? "0.00",
      reason: i.reason,
      condition: i.condition || "UNOPENED",
      customerNote: i.customerNote,
    }));

    const proration = prorationService.calculateProratedRefund(prorationItems);

    // 3. Status determination: auto-approve vs pending review
    const status = eligibility.autoApprove
      ? ReturnStatusEnum.APPROVED
      : ReturnStatusEnum.REQUESTED;

    const returnId = await returnRepository.createReturn(
      {
        orderId: input.orderId,
        customerId,
        sellerId: input.sellerId,
        reasonCategory: input.reasonCategory,
        customerComments: input.customerComments,
        subtotalRefund: proration.subtotalRefund,
        taxRefund: proration.taxRefund,
        shippingDeduction: proration.shippingDeduction,
        totalRefund: proration.totalRefund,
        currency: "USD",
        policyVersion: eligibility.policyVersion,
        requiresManualReview: eligibility.requiresManualReview,
        autoApproved: eligibility.autoApprove,
        status,
        deliveredAt: input.deliveredAt
          ? new Date(input.deliveredAt)
          : new Date(),
      },
      proration.items,
      input.evidenceMedia,
    );

    // 4. Publish return.requested event via Outbox
    await outboxRepository.insertMessage("return.requested", returnId, {
      returnId,
      orderId: input.orderId,
      customerId,
      sellerId: input.sellerId,
      status,
      items: input.items.map((it) => ({
        orderItemId: it.orderItemId,
        productId: it.productId,
        quantity: it.quantity,
        reason: it.reason,
      })),
      requestedAt: new Date().toISOString(),
    });

    // If auto-approved, also write return.approved event
    if (eligibility.autoApprove) {
      await outboxRepository.insertMessage("return.approved", returnId, {
        returnId,
        orderId: input.orderId,
        customerId,
        sellerId: input.sellerId,
        approvedBy: "SYSTEM_AUTO_APPROVAL",
        approvedRole: "SYSTEM",
        providePrepaidLabel: true,
        approvedAt: new Date().toISOString(),
      });
    }

    return {
      returnId,
      status,
      autoApproved: eligibility.autoApprove,
      subtotalRefund: proration.subtotalRefund,
      taxRefund: proration.taxRefund,
      totalRefund: proration.totalRefund,
    };
  }

  async getCustomerReturns(customerId: string, limit = 20, offset = 0) {
    return returnRepository.findByCustomerId(customerId, limit, offset);
  }

  async getReturnById(returnId: string, customerId?: string) {
    const ret = await returnRepository.findById(returnId);
    if (!ret) {
      throw new Error(`Return '${returnId}' not found.`);
    }
    if (customerId && ret.customerId !== customerId) {
      throw new Error(
        "Access denied: You do not have permission to view this return request.",
      );
    }
    return ret;
  }

  async cancelReturn(returnId: string, customerId: string, reason?: string) {
    const ret = await this.getReturnById(returnId, customerId);

    ReturnStateMachine.assertTransition(
      ret.status as ReturnStatus,
      ReturnStatusEnum.CANCELLED,
    );

    await returnRepository.updateStatus(
      returnId,
      ret.status,
      ReturnStatusEnum.CANCELLED,
      customerId,
      "CUSTOMER",
      reason || "Cancelled by customer",
    );

    await outboxRepository.insertMessage("return.cancelled", returnId, {
      returnId,
      orderId: ret.orderId,
      customerId,
      cancelledBy: customerId,
      cancelReason: reason || "Cancelled by customer",
      cancelledAt: new Date().toISOString(),
    });

    return { success: true, status: ReturnStatusEnum.CANCELLED };
  }

  async attachEvidence(
    returnId: string,
    customerId: string,
    evidence: {
      mediaId: string;
      url: string;
      mediaType?: string;
      caption?: string;
    },
  ) {
    const ret = await this.getReturnById(returnId, customerId);
    const mediaId = await returnRepository.attachEvidence(
      returnId,
      evidence.mediaId,
      evidence.url,
      evidence.mediaType || "PHOTO",
      "CUSTOMER",
      evidence.caption,
    );
    return { success: true, mediaId };
  }

  async submitTracking(
    returnId: string,
    customerId: string,
    carrierName: string,
    trackingNumber: string,
  ) {
    const ret = await this.getReturnById(returnId, customerId);

    const currentStatus = ret.status as ReturnStatus;
    if (
      currentStatus !== ReturnStatusEnum.APPROVED &&
      currentStatus !== ReturnStatusEnum.AWAITING_RETURN_SHIPMENT
    ) {
      throw new Error(
        `Cannot submit tracking in status '${currentStatus}'. Return must be APPROVED or AWAITING_RETURN_SHIPMENT.`,
      );
    }

    await shipmentRepository.createShipment({
      returnId,
      carrierName,
      trackingNumber,
      isPrepaid: false,
      paidBy: "BUYER",
      shippingFee: "0.00",
      trackingStatus: "IN_TRANSIT",
    });

    await returnRepository.updateStatus(
      returnId,
      currentStatus,
      ReturnStatusEnum.IN_TRANSIT,
      customerId,
      "CUSTOMER",
      `Customer submitted tracking: ${carrierName} - ${trackingNumber}`,
    );

    return { success: true, status: ReturnStatusEnum.IN_TRANSIT };
  }
}

export const returnService = new ReturnService();
