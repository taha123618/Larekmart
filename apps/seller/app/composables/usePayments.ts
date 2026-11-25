import { useApi } from "./useApi";

export interface SellerCodStatus {
  orderId: string;
  courierId: string;
  expectedAmount: number;
  collectedAmount: number;
  remittedAmount: number;
  currency: string;
  status:
    | "PENDING_COLLECTION"
    | "COLLECTED_BY_COURIER"
    | "REMITTED_TO_MARKETPLACE"
    | "DISPUTED";
  collectedAt?: string;
  remittedAt?: string;
  receiptReference?: string;
}

export function usePayments() {
  const api = useApi();

  const getCodOrderStatus = async (orderId: string): Promise<SellerCodStatus | null> => {
    try {
      const res = await api.get<{ record?: SellerCodStatus }>(
        `/api/v1/payments/cod/${encodeURIComponent(orderId)}`,
      );
      return res?.record ?? null;
    } catch {
      return null;
    }
  };

  return {
    getCodOrderStatus,
  };
}
