import { ReturnStatus, ReturnStatusEnum } from "@repo/types";

export class ReturnStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
    [ReturnStatusEnum.REQUESTED]: [
      ReturnStatusEnum.PENDING_REVIEW,
      ReturnStatusEnum.APPROVED,
      ReturnStatusEnum.REJECTED,
      ReturnStatusEnum.CANCELLED,
    ],
    [ReturnStatusEnum.PENDING_REVIEW]: [
      ReturnStatusEnum.APPROVED,
      ReturnStatusEnum.REJECTED,
      ReturnStatusEnum.CANCELLED,
    ],
    [ReturnStatusEnum.APPROVED]: [
      ReturnStatusEnum.AWAITING_RETURN_SHIPMENT,
      ReturnStatusEnum.CANCELLED,
    ],
    [ReturnStatusEnum.AWAITING_RETURN_SHIPMENT]: [
      ReturnStatusEnum.IN_TRANSIT,
      ReturnStatusEnum.RECEIVED,
      ReturnStatusEnum.CANCELLED,
    ],
    [ReturnStatusEnum.IN_TRANSIT]: [
      ReturnStatusEnum.RECEIVED,
      ReturnStatusEnum.DISPUTED,
    ],
    [ReturnStatusEnum.RECEIVED]: [
      ReturnStatusEnum.INSPECTION,
    ],
    [ReturnStatusEnum.INSPECTION]: [
      ReturnStatusEnum.REFUND_PENDING,
      ReturnStatusEnum.DISPUTED,
      ReturnStatusEnum.REJECTED,
    ],
    [ReturnStatusEnum.DISPUTED]: [
      ReturnStatusEnum.INSPECTION,
      ReturnStatusEnum.REFUND_PENDING,
      ReturnStatusEnum.REJECTED,
    ],
    [ReturnStatusEnum.REFUND_PENDING]: [
      ReturnStatusEnum.COMPLETED,
      ReturnStatusEnum.REFUND_FAILED,
    ],
    [ReturnStatusEnum.REFUND_FAILED]: [
      ReturnStatusEnum.REFUND_PENDING,
      ReturnStatusEnum.DISPUTED,
    ],
    [ReturnStatusEnum.COMPLETED]: [],
    [ReturnStatusEnum.REJECTED]: [],
    [ReturnStatusEnum.CANCELLED]: [],
  };

  static canTransition(currentStatus: ReturnStatus, nextStatus: ReturnStatus): boolean {
    const allowed = this.ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed) return false;
    return (allowed as readonly string[]).includes(nextStatus);
  }

  static assertTransition(currentStatus: ReturnStatus, nextStatus: ReturnStatus): void {
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new Error(
        `Invalid return state transition from '${currentStatus}' to '${nextStatus}'.`,
      );
    }
  }

  static isTerminalState(status: ReturnStatus): boolean {
    return (
      status === ReturnStatusEnum.COMPLETED ||
      status === ReturnStatusEnum.REJECTED ||
      status === ReturnStatusEnum.CANCELLED
    );
  }
}
