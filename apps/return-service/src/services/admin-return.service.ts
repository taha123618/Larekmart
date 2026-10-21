import {
  ReturnStatusEnum,
  ReturnStatus,
  ReturnInspectionDispositionEnum,
} from "@repo/types";
import { v4 as uuidv4 } from "uuid";
import { returnRepository } from "../repositories/return.repository.js";
import {
  inspectionRepository,
  RecordInspectionData,
} from "../repositories/inspection.repository.js";
import { refundRepository } from "../repositories/refund.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { ReturnStateMachine } from "./state-machine.js";

export class AdminReturnService {
  async listReturns(
    filters: {
      status?: string;
      sellerId?: string;
      requiresManualReview?: boolean;
    },
    limit = 50,
    offset = 0,
  ) {
    return returnRepository.listReturns(filters, limit, offset);
  }

  async getReturnDetails(returnId: string) {
    const ret = await returnRepository.findById(returnId);
    if (!ret) {
      throw new Error(`Return '${returnId}' not found.`);
    }
    return ret;
  }

  async approveReturn(
    returnId: string,
    reviewerId: string,
    reviewerRole: string,
    providePrepaidLabel = true,
    notes?: string,
  ) {
    const ret = await this.getReturnDetails(returnId);
    const currentStatus = ret.status as ReturnStatus;

    ReturnStateMachine.assertTransition(
      currentStatus,
      ReturnStatusEnum.APPROVED,
    );

    await returnRepository.updateStatus(
      returnId,
      currentStatus,
      ReturnStatusEnum.APPROVED,
      reviewerId,
      reviewerRole,
      notes || "Approved by reviewer",
      { autoApproved: false },
    );

    // Publish return.approved
    await outboxRepository.insertMessage("return.approved", returnId, {
      returnId,
      orderId: ret.orderId,
      customerId: ret.customerId,
      sellerId: ret.sellerId,
      approvedBy: reviewerId,
      approvedRole: reviewerRole,
      providePrepaidLabel,
      approvedAt: new Date().toISOString(),
    });

    // If prepaid label requested, also publish return.shipment.requested
    if (providePrepaidLabel) {
      await outboxRepository.insertMessage(
        "return.shipment.requested",
        returnId,
        {
          returnId,
          orderId: ret.orderId,
          customerId: ret.customerId,
          sellerId: ret.sellerId,
          prepaidBySeller: true,
          requestedAt: new Date().toISOString(),
        },
      );
    }

    return { success: true, status: ReturnStatusEnum.APPROVED };
  }

  async rejectReturn(
    returnId: string,
    reviewerId: string,
    reviewerRole: string,
    rejectionReason: string,
  ) {
    const ret = await this.getReturnDetails(returnId);
    const currentStatus = ret.status as ReturnStatus;

    ReturnStateMachine.assertTransition(
      currentStatus,
      ReturnStatusEnum.REJECTED,
    );

    await returnRepository.updateStatus(
      returnId,
      currentStatus,
      ReturnStatusEnum.REJECTED,
      reviewerId,
      reviewerRole,
      rejectionReason,
    );

    await outboxRepository.insertMessage("return.rejected", returnId, {
      returnId,
      orderId: ret.orderId,
      customerId: ret.customerId,
      rejectedBy: reviewerId,
      rejectionReason,
      rejectedAt: new Date().toISOString(),
    });

    return { success: true, status: ReturnStatusEnum.REJECTED };
  }

  async recordInspection(
    returnId: string,
    inspectorId: string,
    data: {
      overallCondition: string;
      items: Array<{
        returnItemId: string;
        receivedCondition: string;
        disposition: string;
        notes?: string;
      }>;
      notes?: string;
    },
  ) {
    const ret = await this.getReturnDetails(returnId);
    const currentStatus = ret.status as ReturnStatus;

    // Check valid transition from current state to INSPECTION / REFUND_PENDING
    if (currentStatus === ReturnStatusEnum.RECEIVED) {
      await returnRepository.updateStatus(
        returnId,
        currentStatus,
        ReturnStatusEnum.INSPECTION,
        inspectorId,
        "ADMIN",
        "Item received at warehouse and inspection begun",
      );
    }

    // Record inspection outcomes in repository
    const inspectionData: RecordInspectionData = {
      returnId,
      inspectorId,
      overallCondition: data.overallCondition,
      disposition:
        data.items[0]?.disposition ||
        ReturnInspectionDispositionEnum.RESTOCK_SELLABLE,
      notes: data.notes,
      itemDispositions: data.items,
    };
    await inspectionRepository.recordInspection(inspectionData);

    // Determine if any items are restockable
    const restockableItems = data.items
      .filter(
        (it) =>
          it.disposition === ReturnInspectionDispositionEnum.RESTOCK_SELLABLE,
      )
      .map((it) => {
        const matchingReturnItem = ret.items.find(
          (ri) => ri.id === it.returnItemId,
        );
        return {
          productId: matchingReturnItem?.productId || "",
          quantity: matchingReturnItem?.quantity || 1,
        };
      })
      .filter((it) => it.productId !== "");

    // Publish return.inspection.completed event
    await outboxRepository.insertMessage(
      "return.inspection.completed",
      returnId,
      {
        returnId,
        orderId: ret.orderId,
        customerId: ret.customerId,
        sellerId: ret.sellerId,
        inspectorId,
        disposition:
          data.items[0]?.disposition ||
          ReturnInspectionDispositionEnum.RESTOCK_SELLABLE,
        restockableItems,
        inspectedAt: new Date().toISOString(),
      },
    );

    // Move to REFUND_PENDING and trigger refund SAGA
    await returnRepository.updateStatus(
      returnId,
      ReturnStatusEnum.INSPECTION,
      ReturnStatusEnum.REFUND_PENDING,
      inspectorId,
      "ADMIN",
      "Inspection passed; queued for financial refund execution",
    );

    const idempotencyKey = `refund-${returnId}-${uuidv4().substring(0, 8)}`;
    await refundRepository.createRefundRequest({
      returnId,
      paymentIntentId: `pi_mock_${ret.orderId}`,
      idempotencyKey,
      amount: ret.totalRefund,
      taxAmount: ret.taxRefund,
      shippingDeduction: ret.shippingDeduction,
      currency: ret.currency,
    });

    // Publish return.refund.requested event
    await outboxRepository.insertMessage("return.refund.requested", returnId, {
      returnId,
      orderId: ret.orderId,
      customerId: ret.customerId,
      paymentIntentId: `pi_mock_${ret.orderId}`,
      idempotencyKey,
      subtotalRefund: ret.subtotalRefund,
      taxRefund: ret.taxRefund,
      shippingDeduction: ret.shippingDeduction,
      totalRefund: ret.totalRefund,
      currency: ret.currency,
      requestedAt: new Date().toISOString(),
    });

    return {
      success: true,
      status: ReturnStatusEnum.REFUND_PENDING,
      idempotencyKey,
    };
  }

  async retryRefund(returnId: string, adminId: string) {
    const ret = await this.getReturnDetails(returnId);
    const currentStatus = ret.status as ReturnStatus;

    if (
      currentStatus !== ReturnStatusEnum.REFUND_FAILED &&
      currentStatus !== ReturnStatusEnum.REFUND_PENDING
    ) {
      throw new Error(
        `Cannot retry refund for return in status '${currentStatus}'. Must be REFUND_FAILED.`,
      );
    }

    await returnRepository.updateStatus(
      returnId,
      currentStatus,
      ReturnStatusEnum.REFUND_PENDING,
      adminId,
      "ADMIN",
      "Manual retry of refund initiated by administrator",
    );

    const idempotencyKey = `refund-${returnId}-${uuidv4().substring(0, 8)}`;
    await refundRepository.createRefundRequest({
      returnId,
      paymentIntentId: `pi_mock_${ret.orderId}`,
      idempotencyKey,
      amount: ret.totalRefund,
      taxAmount: ret.taxRefund,
      shippingDeduction: ret.shippingDeduction,
      currency: ret.currency,
    });

    await outboxRepository.insertMessage("return.refund.requested", returnId, {
      returnId,
      orderId: ret.orderId,
      customerId: ret.customerId,
      paymentIntentId: `pi_mock_${ret.orderId}`,
      idempotencyKey,
      subtotalRefund: ret.subtotalRefund,
      taxRefund: ret.taxRefund,
      shippingDeduction: ret.shippingDeduction,
      totalRefund: ret.totalRefund,
      currency: ret.currency,
      requestedAt: new Date().toISOString(),
    });

    return {
      success: true,
      status: ReturnStatusEnum.REFUND_PENDING,
      idempotencyKey,
    };
  }
}

export const adminReturnService = new AdminReturnService();
