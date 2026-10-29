/**
 * useCatalogQuery.ts
 *
 * React Query hooks for catalog-service endpoints.
 * Used in client components that need live catalog data (e.g., dynamic filters,
 * brand selectors, collection pickers).
 *
 * For server components (pages), use the functions in catalog.service.ts directly.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { CatalogProductQuery } from "@/services/catalog.service";
import { getApiGatewayUrl } from "@/services/gateway.service";

const BASE = `${getApiGatewayUrl()}/api/v1/catalog`;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`catalog-service: ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const catalogKeys = {
  all: ["catalog"] as const,
  products: (q: CatalogProductQuery) => ["catalog", "products", q] as const,
  product: (id: string) => ["catalog", "product", id] as const,
  categories: () => ["catalog", "categories"] as const,
  categoryTree: () => ["catalog", "categories", "tree"] as const,
  brands: () => ["catalog", "brands"] as const,
  collections: () => ["catalog", "collections"] as const,
  collection: (id: string) => ["catalog", "collection", id] as const,
  featured: (limit: number) => ["catalog", "featured", limit] as const,
  newArrivals: (limit: number) => ["catalog", "new-arrivals", limit] as const,
  bestSellers: (limit: number) => ["catalog", "best-sellers", limit] as const,
  storefront: () => ["catalog", "storefront"] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Paginated product listing from catalog read model. */
export function useCatalogProducts(query: CatalogProductQuery = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.sort) params.set("sort", query.sort);
  if (query.category && query.category !== "all")
    params.set("category", query.category);
  if (query.brand) params.set("brand", query.brand);
  if (query.minPrice !== undefined)
    params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined)
    params.set("maxPrice", String(query.maxPrice));
  if (query.availability && query.availability !== "all")
    params.set("availability", query.availability);
  if (query.isFeatured !== undefined)
    params.set("isFeatured", String(query.isFeatured));
  if (query.isNew !== undefined) params.set("isNew", String(query.isNew));

  return useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: () => get(`/products?${params.toString()}`),
    staleTime: 60_000,
  });
}

/** Single product card from catalog read model. */
export function useCatalogProduct(idOrSlug: string) {
  return useQuery({
    queryKey: catalogKeys.product(idOrSlug),
    queryFn: () => get(`/products/${idOrSlug}`),
    enabled: !!idOrSlug,
    staleTime: 60_000,
  });
}

/** Flat category list for filter dropdowns. */
export function useCatalogCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: () => get("/categories"),
    staleTime: 5 * 60_000, // 5 min — categories rarely change
  });
}

/** Full hierarchical category tree. */
export function useCatalogCategoryTree() {
  return useQuery({
    queryKey: catalogKeys.categoryTree(),
    queryFn: () => get("/categories?tree=true"),
    staleTime: 5 * 60_000,
  });
}

/** All active brands for the filter sidebar. */
export function useCatalogBrands() {
  return useQuery({
    queryKey: catalogKeys.brands(),
    queryFn: () => get("/brands"),
    staleTime: 5 * 60_000,
  });
}

/** All active collections (for collection pages or homepage hero). */
export function useCatalogCollections() {
  return useQuery({
    queryKey: catalogKeys.collections(),
    queryFn: () => get("/collections"),
    staleTime: 5 * 60_000,
  });
}

/** Single collection with product cards. */
export function useCatalogCollection(slugOrId: string) {
  return useQuery({
    queryKey: catalogKeys.collection(slugOrId),
    queryFn: () => get(`/collections/${slugOrId}`),
    enabled: !!slugOrId,
    staleTime: 60_000,
  });
}

/** Featured products carousel (client-side). */
export function useFeaturedProducts(limit = 8) {
  return useQuery({
    queryKey: catalogKeys.featured(limit),
    queryFn: () => get(`/featured?limit=${limit}`),
    staleTime: 60_000,
  });
}

/** New arrivals carousel (client-side). */
export function useNewArrivals(limit = 8) {
  return useQuery({
    queryKey: catalogKeys.newArrivals(limit),
    queryFn: () => get(`/new-arrivals?limit=${limit}`),
    staleTime: 60_000,
  });
}

/** Best sellers carousel (client-side). */
export function useBestSellers(limit = 8) {
  return useQuery({
    queryKey: catalogKeys.bestSellers(limit),
    queryFn: () => get(`/best-sellers?limit=${limit}`),
    staleTime: 60_000,
  });
}

/** Full storefront overview for the homepage (client-side). */
export function useStorefront() {
  return useQuery({
    queryKey: catalogKeys.storefront(),
    queryFn: () => get("/storefront"),
    staleTime: 60_000,
  });
}
