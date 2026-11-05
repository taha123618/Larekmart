import {
  ReturnStatusEnum,
  ReturnStatus,
  ReturnInspectionDispositionEnum,
} from "@repo/types";
import { withClusterLock } from "@repo/redis";
import { v4 as uuidv4 } from "uuid";
import { returnRepository } from "../repositories/return.repository.js";
import {
  inspectionRepository,
  RecordInspectionData,
} from "../repositories/inspection.repository.js";
import { refundRepository } from "../repositories/refund.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { ReturnStateMachine } from "./state-machine.js";
import { redis } from "../utils/redis.js";

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
    const executeInspection = async () => {
      const ret = await this.getReturnDetails(returnId);
      const currentStatus = ret.status as ReturnStatus;

      // If already moved to REFUND_PENDING or COMPLETED, return current state idempotently
      if (
        currentStatus === ReturnStatusEnum.REFUND_PENDING ||
        currentStatus === ReturnStatusEnum.COMPLETED
      ) {
        const existingRefund = await refundRepository.findByIdempotencyKey(
          `refund-${returnId}`,
        );
        return {
          success: true,
          status: currentStatus,
          idempotencyKey:
            existingRefund?.idempotencyKey ?? `refund-${returnId}`,
          replayed: true,
        };
      }

      // Check valid transition from current state to INSPECTION / REFUND_PENDING
      if (
        currentStatus !== ReturnStatusEnum.RECEIVED &&
        currentStatus !== ReturnStatusEnum.INSPECTION
      ) {
        throw new Error(
          `Cannot inspect return in status '${currentStatus}'. Must be in RECEIVED or INSPECTION status.`,
        );
      }

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

      // Deterministic idempotency key: strictly unique per return
      const idempotencyKey = `refund-${returnId}`;
      const existingRefund =
        await refundRepository.findByIdempotencyKey(idempotencyKey);

      if (!existingRefund) {
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
        await outboxRepository.insertMessage(
          "return.refund.requested",
          returnId,
          {
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
          },
        );
      }

      return {
        success: true,
        status: ReturnStatusEnum.REFUND_PENDING,
        idempotencyKey,
      };
    };

    if (redis.client.status !== "ready" && redis.client.status !== "connect") {
      return executeInspection();
    }

    const lockKey = redis.keys.simple(`lock:inspection:${returnId}`);
    const workerId = `inspector:${inspectorId}:${Date.now()}`;
    const result = await withClusterLock(
      redis.client,
      lockKey,
      workerId,
      executeInspection,
      { ttlMs: 10000 },
    );

    if (result === null) {
      const err = new Error(
        `An inspection is currently in progress for return '${returnId}'.`,
      );
      (err as any).statusCode = 409;
      throw err;
    }

    return result;
  }

  async retryRefund(returnId: string, adminId: string) {
    const executeRetry = async () => {
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

      if (currentStatus === ReturnStatusEnum.REFUND_FAILED) {
        await returnRepository.updateStatus(
          returnId,
          currentStatus,
          ReturnStatusEnum.REFUND_PENDING,
          adminId,
          "ADMIN",
          "Manual retry of refund initiated by administrator",
        );
      }

      const existingRefunds = await refundRepository.findByReturnId(returnId);
      const retryIndex = existingRefunds.length;
      // Deterministic versioned retry idempotency key
      const idempotencyKey = `refund-${returnId}-retry-${retryIndex}`;

      const existingRecord =
        await refundRepository.findByIdempotencyKey(idempotencyKey);

      if (!existingRecord) {
        await refundRepository.createRefundRequest({
          returnId,
          paymentIntentId: `pi_mock_${ret.orderId}`,
          idempotencyKey,
          amount: ret.totalRefund,
          taxAmount: ret.taxRefund,
          shippingDeduction: ret.shippingDeduction,
          currency: ret.currency,
        });

        await outboxRepository.insertMessage(
          "return.refund.requested",
          returnId,
          {
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
          },
        );
      }

      return {
        success: true,
        status: ReturnStatusEnum.REFUND_PENDING,
        idempotencyKey,
      };
    };

    if (redis.client.status !== "ready" && redis.client.status !== "connect") {
      return executeRetry();
    }

    const lockKey = redis.keys.simple(`lock:refund-retry:${returnId}`);
    const workerId = `admin:${adminId}:${Date.now()}`;
    const result = await withClusterLock(
      redis.client,
      lockKey,
      workerId,
      executeRetry,
      { ttlMs: 10000 },
    );

    if (result === null) {
      const err = new Error(
        `A refund retry is currently in progress for return '${returnId}'.`,
      );
      (err as any).statusCode = 409;
      throw err;
    }

    return result;
  }
}

export const adminReturnService = new AdminReturnService();
