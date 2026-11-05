import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Ref } from "vue";
import { computed, unref } from "vue";
import type {
  Seller,
  SellerStore,
  SellerPerformanceSnapshot,
  SellerSettings,
  SellerStaff,
  SellerPolicy,
} from "~/types";
import { useApi } from "./useApi";
import { useSellerStore } from "~/stores/seller.store";

export function useSellers() {
  const api = useApi();
  const sellerStore = useSellerStore();

  return useQuery({
    queryKey: ["sellers", "me"],
    queryFn: async () => {
      const data = await api.get<Seller[]>("/api/v1/sellers/me");
      sellerStore.setSellers(data);
      return data;
    },
  });
}

export function useSellerProfile(sellerId: Ref<string | null> | string) {
  const api = useApi();

  const idRef = computed(() => unref(sellerId));

  return useQuery({
    queryKey: ["seller", idRef],
    queryFn: async () => {
      const id = idRef.value;
      if (!id) return null;
      return api.get<SellerStore>(`/api/v1/sellers/${id}/storefront`);
    },
    enabled: computed(() => Boolean(idRef.value)),
  });
}

export function useSellerSettings(sellerId: Ref<string | null> | string) {
  const api = useApi();
  const idRef = computed(() => unref(sellerId));

  return useQuery({
    queryKey: ["seller", "settings", idRef],
    queryFn: async () => {
      const id = idRef.value;
      if (!id) return null;
      return api.get<SellerSettings>(`/api/v1/sellers/${id}/settings`);
    },
    enabled: computed(() => Boolean(idRef.value)),
  });
}

export function useSellerPerformance(sellerId: Ref<string | null> | string) {
  const api = useApi();
  const idRef = computed(() => unref(sellerId));

  return useQuery({
    queryKey: ["seller", "performance", idRef],
    queryFn: async () => {
      const id = idRef.value;
      if (!id) return null;
      return api.get<SellerPerformanceSnapshot>(
        `/api/v1/sellers/${id}/performance`,
      );
    },
    enabled: computed(() => Boolean(idRef.value)),
  });
}

export function useSellerStaff(sellerId: Ref<string | null> | string) {
  const api = useApi();
  const idRef = computed(() => unref(sellerId));

  return useQuery({
    queryKey: ["seller", "staff", idRef],
    queryFn: async () => {
      const id = idRef.value;
      if (!id) return [];
      return api.get<SellerStaff[]>(`/api/v1/sellers/${id}/staff`);
    },
    enabled: computed(() => Boolean(idRef.value)),
  });
}

export function useSellerPolicies(sellerId: Ref<string | null> | string) {
  const api = useApi();
  const idRef = computed(() => unref(sellerId));

  return useQuery({
    queryKey: ["seller", "policies", idRef],
    queryFn: async () => {
      const id = idRef.value;
      if (!id) return [];
      return api.get<SellerPolicy[]>(`/api/v1/sellers/${id}/policies`);
    },
    enabled: computed(() => Boolean(idRef.value)),
  });
}

export function useCreateSeller() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      vendorId: string;
      storeName: string;
      slug: string;
      primaryCurrency?: string;
    }) => {
      return api.post<Seller>("/api/v1/sellers", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sellers", "me"] });
    },
  });
}
