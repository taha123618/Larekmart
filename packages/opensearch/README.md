# `@repo/opensearch`

Shared OpenSearch infrastructure for the Larekmart monorepo.

Provides a config-driven client factory, the product index mapping, query DSL builders, and a bulk-indexing utility. Any service that needs to read from or write to OpenSearch imports from here.

---

## What's inside

| Export                                                              | Description                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `createOpenSearchClient(config)`                                    | Factory — returns a configured `Client`. No singleton.               |
| `pingOpenSearch(client)`                                            | Health probe — returns `boolean`.                                    |
| `ensureProductIndexExists(client, index, alias, logger?)`           | Creates index + alias if missing.                                    |
| `pointAliasToIndex(client, index, alias, logger?)`                  | Atomically swaps an alias to a new index.                            |
| `createNewVersionedIndex(client, name, logger?)`                    | Creates a versioned index (for zero-downtime reindex).               |
| `PRODUCT_INDEX_SETTINGS`                                            | Edge-ngram analyzers + full field mapping for the product catalog.   |
| `buildProductSearchQuery(params, boosting?)`                        | Full-text + filter + sort + multi-select-aware aggregation DSL body. |
| `buildSearchFilters(params)`                                        | Bool filter array (active, category, brand, price, color, etc.).     |
| `buildAutocompleteQuery(params)`                                    | Three-tier prefix/phrase/edge-ngram suggestion query.                |
| `bulkIndexProducts(client, docs, index, batchSize?, logger?)`       | Batch bulk-index with per-item error tracking.                       |
| `indexProductDocument(client, doc, index, logger?)`                 | Index/replace a single document (refreshed).                         |
| `updateProductDocument(client, id, partial, index, logger?)`        | Partial update via `doc_as_upsert`, stamps `updatedAt`.              |
| `getProductDocument(client, id, index, logger?)`                    | Fetch one document; returns `null` on 404.                           |
| `deleteProductDocument(client, id, index, logger?)`                 | Idempotent single-document delete.                                   |
| `searchProductDocuments(client, index, params, boosting?, logger?)` | Executes the search DSL and shapes hits, total, and facets.          |
| `reindexProducts(client, options, logger?)`                         | Create target index → native `_reindex` → optional alias swap.       |

All types are also exported:
`Client`, `OpenSearchClientConfig`, `SearchBoostingConfig`, `ReindexOptions`, `ReindexResult`,
`ProductSearchResult<T>`, `OpenSearchHit<T>`, `OpenSearchSearchResponse<T>`, `AggregationResult`,
`AggregationBucket`, `BulkOperationResult`.

`Client` is the OpenSearch SDK client type re-exported from this package, so consumers
never need to depend on `@opensearch-project/opensearch` directly.

Facet aggregations are **multi-select aware**: each facet (`categories`, `colors`, `sizes`,
`brands`, `price_stats`) is computed with the other selections applied but **not its own**,
so the remaining options stay visible after one is chosen. Each facet is a nested
`global` → `filtered` → `values`/`stats` aggregation, and `searchProductDocuments`
normalizes that shape back into flat `facets` buckets for callers.

Multi-value facets are **OR within a facet and AND across facets**: pass
`?color=red,blue` (or the param repeated) and a product matching either colour is returned,
while a different facet still narrows the result. `SearchQueryParamsSchema` normalizes
`color`/`size` into a lowercased, de-duplicated `string[]`, and the corresponding builders
emit a `terms` clause.

---

## Quick start

```ts
import {
  createOpenSearchClient,
  pingOpenSearch,
  ensureProductIndexExists,
  buildProductSearchQuery,
  bulkIndexProducts,
} from "@repo/opensearch";
import type { SearchQueryParams } from "@repo/types";

// 1. Create a client (caller manages the singleton)
const client = createOpenSearchClient({
  node: process.env.OPENSEARCH_NODE ?? "http://localhost:9200",
  auth: process.env.OPENSEARCH_USERNAME
    ? {
        username: process.env.OPENSEARCH_USERNAME!,
        password: process.env.OPENSEARCH_PASSWORD!,
      }
    : undefined,
  rejectUnauthorized: process.env.NODE_ENV === "production",
});

// 2. Health probe
const healthy = await pingOpenSearch(client); // → boolean

// 3. Ensure index + alias exist on startup
await ensureProductIndexExists(client, "products-v1", "products", logger);

// 4. Build a search query
const queryDsl = buildProductSearchQuery(params satisfies SearchQueryParams);
const response = await client.search({ index: "products", body: queryDsl });

// 5. Bulk-index a batch of documents
const result = await bulkIndexProducts(
  client,
  products,
  "products",
  500,
  logger,
);
console.log(result); // { indexed: N, failed: 0, errors: [], took: Ms }

// 6. Read the index (search execution is shared, so every caller gets the same shape)
const {
  products: hits,
  total,
  facets,
} = await searchProductDocuments(client, "products", params);

// 7. Single-document ops (Kafka consumers) and zero-downtime reindexing
await indexProductDocument(client, product, "products", logger);
await updateProductDocument(
  client,
  product.id,
  { price: 19.99 },
  "products",
  logger,
);
await deleteProductDocument(client, product.id, "products", logger);
await reindexProducts(
  client,
  {
    sourceIndex: "products",
    targetIndex: "products-v2",
    aliasName: "products",
    recreateAlias: true,
  },
  logger,
);
```

---

## Design principles

- **No global singletons.** `createOpenSearchClient` is a pure factory. Each service creates and owns its own instance.
- **No config coupling.** Functions accept explicit parameters; `buildProductSearchQuery` accepts an optional `boosting` arg with sensible defaults so individual services can tune weights via their own config.
- **No side-effect metrics.** Metrics are the calling service's responsibility. Functions accept an optional `logger` for structured logging.
- **Pure query builders.** `buildProductSearchQuery`, `buildSearchFilters`, and `buildAutocompleteQuery` are stateless, synchronous, and easily unit-testable.

---

## Running type-check

```bash
pnpm --filter @repo/opensearch check-types
```
