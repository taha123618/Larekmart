# AGENTS.md — `packages/opensearch` (`@repo/opensearch`)

Scope rules for AI coding agents working in this package.

## 1. Purpose

`@repo/opensearch` is the **single shared source of truth** for all OpenSearch infrastructure across the Larekmart monorepo. It exposes:

- A config-driven **client factory** (`createOpenSearchClient`) and the re-exported SDK `Client` type
- **Product index mappings** and lifecycle helpers (create, alias, reindex)
- **Query DSL builders** — full-text search, filters, autocomplete
- **Search execution** (`searchProductDocuments`) that shapes hits/total/facets consistently
- **Bulk indexing** and **single-document** operations (index, update, get, delete)
- **Zero-downtime reindexing** (`reindexProducts`)
- Low-level **response wrapper types** (`OpenSearchHit<T>`, `OpenSearchSearchResponse<T>`)

## 2. What belongs here

| ✅ Belongs                              | ❌ Does NOT belong                 |
| --------------------------------------- | ---------------------------------- |
| OpenSearch SDK client creation          | Service-specific config (env vars) |
| Index mapping constants                 | Redis / cache logic                |
| Query DSL builders + search execution   | Kafka consumers                    |
| Bulk + single-document indexing helpers | HTTP routes or controllers         |
| Reindex/alias lifecycle helpers         | Metrics counters (pass logger in)  |
| SDK wrapper types                       | Service-specific response caching  |

## 3. Dependency rules

This package depends on:

- `@opensearch-project/opensearch` — SDK
- `@repo/types` — shared domain types (SearchProductDocument, SearchQueryParams, etc.)
- `@repo/monitoring` — logger type only (no config coupling)

It must **never** import from any `apps/*` workspace.

## 4. API design principles

- **No global config singletons.** All functions accept explicit parameters (client, config, etc.).
- **No side-effect metrics.** The caller wires their own metrics; functions accept an optional `logger`.
- **Pure functions where possible.** Query builders are stateless and synchronous.

## 5. Verification

```bash
pnpm --filter @repo/opensearch check-types
```
