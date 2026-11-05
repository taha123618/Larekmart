# OpenSearch Real-Time Micro-Batching & Bulk Indexing Pipeline

**Status**: APPROVED & IN PROGRESS  
**Date**: November 2026  
**Scope**: `apps/search-service`, `@repo/opensearch`, `packages/kafka`

---

## 1. Context & Architectural Bottleneck

The search microservice (`apps/search-service`, port 8006) synchronizes catalog, pricing, inventory, and review data asynchronously from Apache Kafka events to maintain denormalized OpenSearch product documents for fast storefront discovery.

### The Problem

Previously, `product-events.consumer.ts` handled incoming events sequentially via `eachMessage` callbacks, making single-document REST calls to OpenSearch (`indexProductDocument`, `updateProductDocument`, `deleteProductDocument`) on every event.
Under high-throughput flash sales or catalog imports (10,000+ events/min):

1. **Network & Socket Starvation**: 10,000 separate HTTP connections to OpenSearch overwhelm the cluster socket pool and HTTP keep-alive buffers.
2. **Indexing Lag & Segment Thrashing**: OpenSearch performs frequent small-segment Lucene commits rather than batch merges.
3. **Redis Cache Invalidation Storms**: `invalidateSearchCacheNamespace()` was called once per event, repeatedly issuing `KEYS` / `DEL` sweeps against Redis.

---

## 2. Shared Architecture & Invariants

```
Kafka Topics
[product.*, inventory.*, pricing.*]
           │
           ▼
Kafka Consumer (subscribeBatch)
  • Micro-batches up to 100 events per poll
  • Validates and groups operations by document ID
           │
           ▼
IndexingService.bulkExecuteOperations()
  • Constructs OpenSearch NDJSON bulk array (_bulk)
  • Captures in-flight mutations in DriftReconciler (if blue/green reindex active)
  • Dispatches single HTTP POST to OpenSearch /_bulk (refresh: false)
           │
           ▼
Single Atomic Redis Cache Invalidation
  • Flushes search:v1:* namespace once per batch, not per message
```

### Invariants:

1. **OpenSearch NDJSON Bulk API**: Events in a poll chunk (up to 100 events) are composed into a single `client.bulk()` request, cutting HTTP roundtrips by 99%.
2. **Single Batch Cache Invalidation**: `invalidateSearchCacheNamespace()` is invoked exactly once per batch flush.
3. **Drift Reconciler Continuity**: Dual-writing to pending reindex indices (`products-v2`) is preserved across batch operations.
4. **Poison-Pill & Dead-Letter Isolation**: Malformed event payloads fast-fail to `<topic>.dlq` without blocking the batch offset commit.
5. **Backwards Compatibility**: Works transparently with `subscribeBatch` or standard `subscribe` fallbacks.

---

## 3. Implementation Steps

1. **Indexing Service**: Add `bulkExecuteOperations` in `apps/search-service/src/services/indexing.service.ts` to execute batches with OpenSearch `_bulk`.
2. **Event Consumer**: Refactor `apps/search-service/src/consumers/product-events.consumer.ts` to register batch handlers using `consumer.subscribeBatch` with fallback to `consumer.subscribe`.
3. **Testing**: Add automated unit and integration tests verifying batch processing, NDJSON formatting, drift reconciler interception, and single cache flush behavior.
4. **Documentation**: Update `apps/search-service/AGENTS.md`, `README.md`, and monorepo rules.
