import { useQuery } from "@tanstack/vue-query";
import type { MaybeRef } from "vue";
import type { SellerOrder, PaginatedResponse } from "~/types/seller";
import { useSellerStore } from "~/stores/seller.store";

interface OrderListParams {
  page?: number;
  limit?: number;
  status?: string;
  sellerId?: string;
}

export function useOrders(params: MaybeRef<OrderListParams> = {}) {
  const { apiFetch } = useApi();
  const sellerStore = useSellerStore();
  const p = computed(() => unref(params));

  return useQuery({
    queryKey: computed(() => ["seller-orders", sellerStore.activeSellerId, p.value]),
    queryFn: () =>
      apiFetch<PaginatedResponse<SellerOrder> | SellerOrder[]>("/api/v1/seller-orders", {
        query: {
          sellerId: p.value.sellerId ?? sellerStore.activeSellerId ?? undefined,
          page: p.value.page ?? 1,
          limit: p.value.limit ?? 20,
          status: p.value.status,
        },
      }),
  });
}

export function useOrder(orderId: MaybeRef<string>) {
  const { apiFetch } = useApi();
  const id = computed(() => unref(orderId));

  return useQuery({
    queryKey: computed(() => ["order", id.value]),
    queryFn: () => apiFetch<SellerOrder>(`/api/v1/orders/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}
