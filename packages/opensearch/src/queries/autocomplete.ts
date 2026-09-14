import type { SuggestionQuery } from "@repo/types";

/**
 * Builds an OpenSearch query DSL for autocomplete / suggestion lookups.
 *
 * Strategy (highest → lowest boost):
 * 1. `prefix` on `name.keyword` (exact prefix match, case-insensitive) — boost 4
 * 2. `match_phrase_prefix` on `name` — boost 3
 * 3. `match` on `name.autocomplete` (edge-ngram) — boost 2
 *
 * Always filters to `isActive: true`.
 * Returns the fields needed to render a rich suggestion (id, name, brand,
 * category, price, images) so callers can deep-link to the product.
 */
export function buildAutocompleteQuery(
  params: SuggestionQuery,
): Record<string, any> {
  const q = params.q.trim().toLowerCase();

  return {
    size: params.limit * 2, // Over-fetch to allow deduplication by caller
    _source: [
      "id",
      "name",
      "slug",
      "brand",
      "category",
      "categorySlug",
      "price",
      "images",
    ],
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  prefix: {
                    "name.keyword": {
                      value: q,
                      boost: 4.0,
                      case_insensitive: true,
                    },
                  },
                },
                {
                  match_phrase_prefix: {
                    name: { query: q, boost: 3.0 },
                  },
                },
                {
                  match: {
                    "name.autocomplete": { query: q, boost: 2.0 },
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
        ],
        filter: [{ term: { isActive: true } }],
      },
    },
  };
}
