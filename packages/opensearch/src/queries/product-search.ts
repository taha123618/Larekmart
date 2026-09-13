import type { SearchQueryParams } from "@repo/types";
import type { SearchBoostingConfig } from "../types.js";
import {
  buildBaseFilters,
  FACET_FILTER_BUILDERS,
  type FacetKey,
} from "./filters.js";

/** Default field-level boosting weights for product full-text search. */
const DEFAULT_BOOSTING: SearchBoostingConfig = {
  name: 4.0,
  sku: 3.5,
  brand: 2.0,
  category: 2.0,
  tags: 1.5,
  description: 1.0,
};

/**
 * Builds a complete OpenSearch query DSL body for product search.
 *
 * Includes:
 * - Multi-match full-text query with field boosting (or `match_all` if no `q`)
 * - Bool filter clauses (active only, category, brand, price, stock, etc.)
 * - Sort clauses based on `params.sort`
 * - Multi-select-aware aggregations for faceted navigation (categories, colors,
 *   sizes, brands, price stats). Each facet aggregation excludes its own
 *   selection so remaining options stay visible after one is chosen.
 *
 * @param params   - Validated search query parameters
 * @param boosting - Optional field boost overrides; falls back to `DEFAULT_BOOSTING`
 */
export function buildProductSearchQuery(
  params: SearchQueryParams,
  boosting: SearchBoostingConfig = DEFAULT_BOOSTING,
): Record<string, any> {
  const from = (params.page - 1) * params.limit;
  const size = params.limit;

  // The main query applies every selection (so hits, totals, and pagination are
  // exact); facet aggregations recompute their own filters below.
  const baseFilters = buildBaseFilters(params);
  const facetFilters = Object.fromEntries(
    (Object.keys(FACET_FILTER_BUILDERS) as FacetKey[]).map((key) => [
      key,
      FACET_FILTER_BUILDERS[key](params),
    ]),
  ) as Record<FacetKey, any | undefined>;
  const filters = [...baseFilters, ...Object.values(facetFilters).filter(Boolean)];

  // ── Query ──────────────────────────────────────────────────────────────────
  // The text clauses are reused by the facet aggregations so facet counts stay
  // scoped to the current search, not the whole index.
  const textClauses: Record<string, any>[] =
    params.q && params.q.trim().length > 0
      ? [
          {
            multi_match: {
              query: params.q.trim(),
              fields: [
                `name^${boosting.name}`,
                `name.autocomplete^${boosting.name * 0.8}`,
                `sku^${boosting.sku}`,
                `sku.text^${boosting.sku}`,
                `brand^${boosting.brand}`,
                `category^${boosting.category}`,
                `tags^${boosting.tags}`,
                `shortDescription^${boosting.description * 1.2}`,
                `description^${boosting.description}`,
              ],
              type: "best_fields",
              fuzziness: "AUTO",
              prefix_length: 2,
              operator: "and",
            },
          },
        ]
      : [{ match_all: {} }];

  const query: Record<string, any> = {
    bool: {
      must: textClauses,
      filter: filters,
    },
  };

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sort: any[] = [];
  switch (params.sort) {
    case "price_asc":
      sort.push({ price: { order: "asc" } });
      break;
    case "price_desc":
      sort.push({ price: { order: "desc" } });
      break;
    case "newest":
      sort.push({ createdAt: { order: "desc" } });
      break;
    case "oldest":
      sort.push({ createdAt: { order: "asc" } });
      break;
    case "rating":
      sort.push({ rating: { order: "desc", missing: "_last" } });
      break;
    case "popularity":
      sort.push({ reviewCount: { order: "desc", missing: "_last" } });
      break;
    case "discount":
      sort.push({ discountPercentage: { order: "desc", missing: "_last" } });
      break;
    case "relevance":
    default:
      sort.push(params.q ? { _score: { order: "desc" } } : { createdAt: { order: "desc" } });
      break;
  }

  // ── Aggregations (Facets) ──────────────────────────────────────────────────

  /** Base filters plus every facet selection except `exclude`. */
  const filtersFor = (exclude: FacetKey): any[] => [
    ...baseFilters,
    ...(Object.keys(FACET_FILTER_BUILDERS) as FacetKey[])
      .filter((key) => key !== exclude)
      .map((key) => facetFilters[key])
      .filter(Boolean),
  ];

  /**
   * Wraps a facet aggregation in `global` + `filter` so it is scoped to the
   * text query and every other selection, but ignores its **own** selection.
   * `global` breaks out of the main query (so pagination and hit totals stay
   * exact) and the inner filter re-applies everything this facet should see.
   */
  const facetAgg = (
    exclude: FacetKey,
    innerName: string,
    inner: Record<string, any>,
  ) => ({
    global: {},
    aggs: {
      filtered: {
        filter: {
          bool: {
            must: textClauses,
            filter: filtersFor(exclude),
          },
        },
        aggs: { [innerName]: inner },
      },
    },
  });

  const aggs = {
    categories: facetAgg("category", "values", {
      terms: { field: "categorySlug", size: 30 },
    }),
    colors: facetAgg("color", "values", {
      terms: { field: "colors", size: 30 },
    }),
    sizes: facetAgg("size", "values", {
      terms: { field: "sizes", size: 30 },
    }),
    brands: facetAgg("brand", "values", {
      terms: { field: "brand.keyword", size: 30 },
    }),
    price_stats: facetAgg("price", "stats", { stats: { field: "price" } }),
  };

  return { from, size, query, sort, aggs };
}
