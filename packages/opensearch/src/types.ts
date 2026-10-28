/**
 * Low-level OpenSearch SDK response wrapper types.
 * These are distinct from the domain types in @repo/types (which describe
 * the business entities). These types describe the raw shape of OpenSearch
 * API responses so callers can work with strongly-typed hits and aggregations.
 */

/** A single document hit returned by an OpenSearch search query. */
export interface OpenSearchHit<T> {
  _index: string;
  _id: string;
  _score: number | null;
  _source: T;
  highlight?: Record<string, string[]>;
  sort?: (string | number)[];
}

/** The top-level body structure of an OpenSearch search response. */
export interface OpenSearchSearchResponse<T> {
  took: number;
  timed_out: boolean;
  _shards?: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: "eq" | "gte";
    };
    max_score: number | null;
    hits: OpenSearchHit<T>[];
  };
  aggregations?: Record<string, AggregationResult>;
  suggest?: Record<string, unknown>;
}

/** A single terms aggregation bucket. */
export interface AggregationBucket {
  key: string | number;
  doc_count: number;
}

/**
 * Generic aggregation result — callers narrow further as needed.
 *
 * Facet aggregations are nested `global` → `filtered` → buckets/stats, so the
 * optional `filtered`, `values`, and `stats` fields describe that shape.
 */
export interface AggregationResult {
  buckets?: AggregationBucket[];
  value?: number;
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  count?: number;
  /** Present on `filter` aggregations: documents matched by the filter. */
  doc_count?: number;
  /** Inner aggregation of the `filter` wrapper used for multi-select facets. */
  filtered?: AggregationResult;
  /** Nested `terms` aggregation (`filter` → `values`). */
  values?: { buckets?: AggregationBucket[] };
  /** Nested `stats` aggregation (`filter` → `stats`). */
  stats?: AggregationResult;
}

/** Result of a bulk-indexing operation. */
export interface BulkOperationResult {
  indexed: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  took: number;
}

/** Configuration accepted by `createOpenSearchClient`. */
export interface OpenSearchClientConfig {
  /** e.g. "http://localhost:9200" */
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  maxRetries?: number;
  requestTimeout?: number;
  /** Set true in production to enforce TLS validation. */
  rejectUnauthorized?: boolean;
}

/** Field-level boosting weights for the product search query. */
export interface SearchBoostingConfig {
  name: number;
  sku: number;
  brand: number;
  category: number;
  tags: number;
  description: number;
}

/** Options accepted by `reindexProducts`. */
export interface ReindexOptions {
  /** Index (or alias) to read from, e.g. "products". */
  sourceIndex: string;
  /** Versioned index to write into, e.g. "products-v1737000000000". */
  targetIndex: string;
  /** Read alias to swap onto the target index when `recreateAlias` is true. */
  aliasName?: string;
  /** Documents per `_reindex` scroll batch (default 500). */
  batchSize?: number;
  /** When true, atomically point `aliasName` at the target index (default false). */
  recreateAlias?: boolean;
}

/** Outcome of a `reindexProducts` run. */
export interface ReindexResult {
  sourceIndex: string;
  targetIndex: string;
  /** Set when the alias was swapped onto the target index. */
  aliasName?: string;
  created: number;
  updated: number;
  total: number;
  failures: unknown[];
  aliasSwapped: boolean;
  took: number;
}

/** Options for atomic alias swap. */
export interface AtomicSwapOptions {
  aliasName: string;
  newIndex: string;
  oldIndex?: string;
  deleteOldIndex?: boolean;
}

/** Result of index parity verification. */
export interface IndexParityResult {
  sourceIndex: string;
  targetIndex: string;
  sourceCount: number;
  targetCount: number;
  diff: number;
  isHealthy: boolean;
  sampleSearchOk: boolean;
  reason?: string;
}

/** Representation of alias topology across versioned indices. */
export interface AliasTopology {
  aliasName: string;
  currentIndex: string | null;
  allIndices: string[];
  retainedIndices: string[];
}
