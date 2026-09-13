import type { SearchQueryParams } from "@repo/types";

/**
 * Filters that apply to every clause of a search — including every facet
 * aggregation.
 *
 * Facet selections (category, brand, price, color, size) are deliberately kept
 * out of this list so each facet can be aggregated with the *other* facets
 * applied but not its own (multi-select faceting): selecting "black" must not
 * hide every other colour option.
 */
export function buildBaseFilters(params: SearchQueryParams): any[] {
  const filters: any[] = [
    // Only surface active products
    { term: { isActive: true } },
  ];

  // Availability
  if (params.inStock !== undefined) {
    filters.push({ term: { inStock: params.inStock } });
  }

  // Minimum rating
  if (params.rating !== undefined) {
    filters.push({ range: { rating: { gte: params.rating } } });
  }

  // Seller
  if (params.seller) {
    filters.push({ term: { sellerId: params.seller } });
  }

  // Tags (any match)
  if (params.tags && params.tags.length > 0) {
    filters.push({ terms: { tags: params.tags } });
  }

  return filters;
}

/** Category facet selection — prefers the slug (exact keyword), falls back to name. */
export function buildCategoryFilter(params: SearchQueryParams): any | undefined {
  if (params.categorySlug) {
    return { term: { categorySlug: params.categorySlug } };
  }

  if (params.category) {
    return {
      bool: {
        should: [
          { term: { "category.keyword": params.category } },
          { term: { categorySlug: params.category.toLowerCase() } },
        ],
        minimum_should_match: 1,
      },
    };
  }

  return undefined;
}

/** Brand facet selection. */
export function buildBrandFilter(params: SearchQueryParams): any | undefined {
  return params.brand ? { term: { "brand.keyword": params.brand } } : undefined;
}

/** Price facet selection (inclusive range). */
export function buildPriceFilter(params: SearchQueryParams): any | undefined {
  if (params.min_price === undefined && params.max_price === undefined) {
    return undefined;
  }

  const range: Record<string, number> = {};
  if (params.min_price !== undefined) range.gte = params.min_price;
  if (params.max_price !== undefined) range.lte = params.max_price;

  return { range: { price: range } };
}

/**
 * Normalizes a facet selection into the lowercased, de-duplicated keyword
 * values stored in the index. Empty selections produce no filter at all.
 */
function toFacetTerms(values?: string[]): string[] {
  if (!values || values.length === 0) return [];

  return [
    ...new Set(
      values.map((value) => value.trim().toLowerCase()).filter(Boolean),
    ),
  ];
}

/**
 * Colour facet selection. Multi-select is OR within the facet (a product
 * matching any selected colour), while separate facets still AND together.
 */
export function buildColorFilter(params: SearchQueryParams): any | undefined {
  const colors = toFacetTerms(params.color);
  return colors.length > 0 ? { terms: { colors } } : undefined;
}

/**
 * Size facet selection. Multi-select is OR within the facet, matching the
 * colour facet semantics.
 */
export function buildSizeFilter(params: SearchQueryParams): any | undefined {
  const sizes = toFacetTerms(params.size);
  return sizes.length > 0 ? { terms: { sizes } } : undefined;
}

/**
 * The facet selections that have their own aggregation, mapped to the builder
 * that produces their filter clause. Used by `buildProductSearchQuery` to give
 * each facet an aggregation that excludes its own selection.
 */
export const FACET_FILTER_BUILDERS = {
  category: buildCategoryFilter,
  brand: buildBrandFilter,
  price: buildPriceFilter,
  color: buildColorFilter,
  size: buildSizeFilter,
} as const;

/** Keys of the aggregations that behave as multi-select facets. */
export type FacetKey = keyof typeof FACET_FILTER_BUILDERS;

/**
 * Every filter clause for a query (base + facet selections).
 *
 * Kept for backwards compatibility. Multi-select faceted search uses
 * `buildBaseFilters` + `FACET_FILTER_BUILDERS` so each facet aggregation can
 * exclude its own selection.
 */
export function buildSearchFilters(params: SearchQueryParams): any[] {
  const filters = buildBaseFilters(params);

  for (const key of Object.keys(FACET_FILTER_BUILDERS) as FacetKey[]) {
    const clause = FACET_FILTER_BUILDERS[key](params);
    if (clause) filters.push(clause);
  }

  return filters;
}
