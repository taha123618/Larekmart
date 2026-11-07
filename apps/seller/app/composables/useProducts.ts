import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { MaybeRef } from "vue";
import type { Product, PaginatedResponse } from "~/types/seller";

interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: string;
}

export function useProducts(params: MaybeRef<ProductListParams> = {}) {
  const { apiFetch } = useApi();
  const p = computed(() => unref(params));

  return useQuery({
    queryKey: computed(() => ["products", p.value]),
    queryFn: () =>
      apiFetch<PaginatedResponse<Product>>("/api/v1/products", {
        query: {
          page: p.value.page ?? 1,
          limit: p.value.limit ?? 20,
          search: p.value.search,
          status: p.value.status,
          categoryId: p.value.categoryId,
        },
      }),
  });
}

export function useProduct(productId: MaybeRef<string>) {
  const { apiFetch } = useApi();
  const id = computed(() => unref(productId));

  return useQuery({
    queryKey: computed(() => ["product", id.value]),
    queryFn: () => apiFetch<Product>(`/api/v1/products/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useCreateProduct() {
  const { apiFetch } = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: Omit<Product, "id" | "createdAt" | "updatedAt">) =>
      apiFetch<Product>("/api/v1/products", {
        method: "POST",
        body: body as Record<string, unknown>,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct(productId: MaybeRef<string>) {
  const { apiFetch } = useApi();
  const id = computed(() => unref(productId));
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: Partial<Product>) =>
      apiFetch<Product>(`/api/v1/products/${unref(id)}`, {
        method: "PATCH",
        body: body as Record<string, unknown>,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", unref(id)] });
    },
  });
}
