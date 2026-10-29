/**
 * catalog.service.ts
 *
 * Client-side API service for catalog-service (port 8010).
 * Used for read-optimized product discovery, categories, brands, collections.
 *
 * Architecture:
 *   catalog-service = CQRS read model (fast, pre-computed, cached)
 *   product-service = source of truth (mutations)
 *   search-service  = full-text / fuzzy search
 *
 * The client uses catalog-service for:
 *   - Category tree (instead of hardcoded array)
 *   - Product listings (as a fallback if search-service is down)
 *   - Featured / new-arrivals / best-sellers (homepage carousels)
 *   - Product detail cards (pre-computed read model)
 *   - Brands and Collections
 *   - Storefront overview (full homepage layout)
 */

import { getApiGatewayUrl } from "../services/gateway.service";

const BASE = `${getApiGatewayUrl()}/api/v1/catalog`;

// ─── Types (mirrors CatalogProductCardType from @repo/types) ────────────────

export type CatalogBadge = "New" | "Featured" | "Sale" | string;

export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface CatalogCategory {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  position: number;
  isActive: boolean;
  productCount: number;
  children: CatalogCategory[];
}

export interface CatalogProductVariant {
  id: string;
  productId: string;
  variantId: string;
  size: string;
  color: string;
  sku?: string | null;
  price: number;
  inStock: boolean;
}

export interface CatalogProductCard {
  id: string;
  productId: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  thumbnailUrl: string;
  images?: Record<string, string>;
  price: number;
  compareAtPrice?: number | null;
  discountPercentage: number;
  rating: number;
  reviewCount: number;
  availabilityStatus: "in_stock" | "low_stock" | "out_of_stock";
  brand?: CatalogBrand | null;
  primaryCategory?: { id: string; name: string; slug: string } | null;
  badges: CatalogBadge[];
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
}

export interface CatalogPaginatedResponse {
  data: CatalogProductCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CatalogCollection {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  status: "active" | "draft" | "archived";
  sortOrder: number;
  productCount: number;
  products?: CatalogProductCard[];
}

export interface StorefrontOverview {
  heroCollections: CatalogCollection[];
  sections: Array<{
    id: string;
    title: string;
    subtitle: string;
    products: CatalogProductCard[];
  }>;
  categories: CatalogCategory[];
}

// ─── Query Parameters ────────────────────────────────────────────────────────

export interface CatalogProductQuery {
  page?: number;
  limit?: number;
  sort?:
    | "newest"
    | "price_asc"
    | "price_desc"
    | "rating"
    | "featured"
    | "popular";
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "all";
  isFeatured?: boolean;
  isNew?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }, // 1-minute ISR cache
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Paginated product listing with filters.
 * Used as the catalog fallback when search-service is unavailable.
 */
export async function fetchCatalogProducts(
  query: CatalogProductQuery = {},
): Promise<CatalogPaginatedResponse> {
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

  return safeFetch<CatalogPaginatedResponse>(
    `${BASE}/products?${params.toString()}`,
    {
      data: [],
      pagination: {
        page: 1,
        limit: 24,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    },
  );
}

/**
 * Single product card by UUID or slug.
 * Used on product detail pages as a fast alternative to product-service.
 */
export async function fetchCatalogProductById(
  idOrSlug: string,
): Promise<CatalogProductCard | null> {
  try {
    const res = await fetch(`${BASE}/products/${idOrSlug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CatalogProductCard;
  } catch {
    return null;
  }
}

/**
 * Category tree (hierarchical) from catalog read model.
 * Replaces hardcoded category array in Categories.tsx.
 */
export async function fetchCatalogCategoryTree(): Promise<CatalogCategory[]> {
  return safeFetch<CatalogCategory[]>(`${BASE}/categories?tree=true`, []);
}

/**
 * Flat list of all active categories.
 */
export async function fetchCatalogCategories(): Promise<CatalogCategory[]> {
  return safeFetch<CatalogCategory[]>(`${BASE}/categories`, []);
}

/**
 * Featured products for carousels and homepage.
 */
export async function fetchFeaturedProducts(
  limit = 8,
): Promise<CatalogProductCard[]> {
  return safeFetch<CatalogProductCard[]>(`${BASE}/featured?limit=${limit}`, []);
}

/**
 * New arrivals carousel.
 */
export async function fetchNewArrivals(
  limit = 8,
): Promise<CatalogProductCard[]> {
  return safeFetch<CatalogProductCard[]>(
    `${BASE}/new-arrivals?limit=${limit}`,
    [],
  );
}

/**
 * Best sellers carousel.
 */
export async function fetchBestSellers(
  limit = 8,
): Promise<CatalogProductCard[]> {
  return safeFetch<CatalogProductCard[]>(
    `${BASE}/best-sellers?limit=${limit}`,
    [],
  );
}

/**
 * All active brands for filter sidebar.
 */
export async function fetchCatalogBrands(): Promise<CatalogBrand[]> {
  return safeFetch<CatalogBrand[]>(`${BASE}/brands`, []);
}

/**
 * All active collections (homepage hero, merchandising).
 */
export async function fetchCatalogCollections(): Promise<CatalogCollection[]> {
  return safeFetch<CatalogCollection[]>(`${BASE}/collections`, []);
}

/**
 * Full collection detail with ordered product cards.
 */
export async function fetchCatalogCollection(
  slugOrId: string,
): Promise<CatalogCollection | null> {
  try {
    const res = await fetch(`${BASE}/collections/${slugOrId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CatalogCollection;
  } catch {
    return null;
  }
}

/**
 * Full storefront overview: hero collections + 3 merchandising sections + category nav.
 * The single call the homepage makes to get everything.
 */
export async function fetchStorefrontOverview(): Promise<StorefrontOverview | null> {
  try {
    const res = await fetch(`${BASE}/storefront`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as StorefrontOverview;
  } catch {
    return null;
  }
}
