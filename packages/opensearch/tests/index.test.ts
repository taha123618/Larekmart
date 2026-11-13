import assert from "node:assert";
import {
  buildProductSearchQuery,
  buildSearchFilters,
  buildAutocompleteQuery,
  DLQ_INDEX_NAME,
  DLQ_INDEX_SETTINGS,
  searchDlqRecords,
} from "../src/index.js";

async function runOpenSearchTests(): Promise<void> {
  console.log("==================================================");
  console.log("🔍 @repo/opensearch Query Builder & DLQ Test Suite");
  console.log("==================================================");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: buildProductSearchQuery with empty query
    // -------------------------------------------------------------------------
    console.log("\n1. Testing product search query generation (match_all)...");
    const emptyQuery = buildProductSearchQuery({
      page: 1,
      limit: 20,
      sort: "relevance",
    });

    assert.strictEqual(emptyQuery.from, 0);
    assert.strictEqual(emptyQuery.size, 20);
    assert.deepStrictEqual(emptyQuery.query.bool.must, [{ match_all: {} }]);
    console.log("  ✓ Empty search generated match_all clause with pagination");

    // -------------------------------------------------------------------------
    // TEST 2: buildProductSearchQuery with text search & field boosts
    // -------------------------------------------------------------------------
    console.log("\n2. Testing multi_match query with boosting...");
    const textQuery = buildProductSearchQuery({
      q: "Wireless Noise-Canceling Headphones",
      page: 2,
      limit: 10,
      sort: "price_asc",
    });

    assert.strictEqual(textQuery.from, 10);
    assert.strictEqual(textQuery.size, 10);
    const multiMatch = textQuery.query.bool.must[0].multi_match;
    assert.strictEqual(multiMatch.query, "Wireless Noise-Canceling Headphones");
    assert.ok(multiMatch.fields.includes("name^4"));
    assert.ok(multiMatch.fields.includes("sku^3.5"));
    assert.deepStrictEqual(textQuery.sort, [{ price: { order: "asc" } }]);
    console.log(
      "  ✓ Multi-match boosting and price_asc sort ordering verified",
    );

    // -------------------------------------------------------------------------
    // TEST 3: buildSearchFilters with facets, price ranges, and stock
    // -------------------------------------------------------------------------
    console.log("\n3. Testing faceted search filters...");
    const filters = buildSearchFilters({
      page: 1,
      limit: 20,
      sort: "newest",
      category: "electronics",
      brand: "Sony",
      min_price: 50,
      max_price: 300,
      color: ["black", "blue"],
      inStock: true,
    });

    const activeFilter = filters.find((f: any) => f.term?.isActive === true);
    assert.ok(activeFilter, "Active filter should be present");

    const categoryFilter = filters.find((f: any) => f.bool?.should);
    assert.ok(categoryFilter, "Category bool.should filter should be present");
    assert.strictEqual(
      categoryFilter.bool.should[0]?.term?.["category.keyword"],
      "electronics",
    );

    const brandFilter = filters.find((f: any) => f.term?.["brand.keyword"]);
    assert.strictEqual(brandFilter.term["brand.keyword"], "Sony");

    const priceFilter = filters.find((f: any) => f.range?.price);
    assert.strictEqual(priceFilter.range.price.gte, 50);
    assert.strictEqual(priceFilter.range.price.lte, 300);

    const colorFilter = filters.find((f: any) => f.terms?.colors);
    assert.deepStrictEqual(colorFilter.terms.colors, ["black", "blue"]);

    const stockFilter = filters.find((f: any) => f.term?.inStock === true);
    assert.ok(stockFilter, "In-stock filter should be present");
    console.log(
      "  ✓ Terms, range, facets, and stock filters properly constructed",
    );

    // -------------------------------------------------------------------------
    // TEST 4: buildAutocompleteQuery
    // -------------------------------------------------------------------------
    console.log("\n4. Testing autocomplete prefix query builder...");
    const acQuery = buildAutocompleteQuery({
      q: "headph",
      limit: 5,
    });

    // buildAutocompleteQuery over-fetches (limit * 2) to allow deduplication by caller
    assert.strictEqual(acQuery.size, 10);
    assert.ok(acQuery.query.bool.must.length > 0);
    console.log("  ✓ Autocomplete prefix/edge-ngram query generated cleanly");

    // -------------------------------------------------------------------------
    // TEST 5: DLQ Index Settings & Schema Verification
    // -------------------------------------------------------------------------
    console.log("\n5. Testing DLQ audit index mappings & properties...");
    assert.strictEqual(DLQ_INDEX_NAME, "larekmart-dlq-records");
    const props = DLQ_INDEX_SETTINGS.mappings.properties;
    assert.strictEqual(props.originalTopic.type, "keyword");
    assert.strictEqual(props.errorMessage.type, "text");
    assert.strictEqual(props.errorStack.type, "text");
    assert.strictEqual(props.isPoisonPill.type, "boolean");
    assert.strictEqual(props.attemptCount.type, "integer");
    assert.strictEqual(props.replayCount.type, "integer");
    assert.strictEqual(props.status.type, "keyword");
    console.log("  ✓ DLQ index schema mapping fields verified");

    // -------------------------------------------------------------------------
    // TEST 6: searchDlqRecords with Mock OpenSearch Client
    // -------------------------------------------------------------------------
    console.log(
      "\n6. Testing searchDlqRecords with query builder and filters...",
    );
    let capturedSearchBody: any = null;

    const mockClient = {
      search: async (params: any) => {
        capturedSearchBody = params.body;
        return {
          body: {
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    id: "order.created.dlq-0-101",
                    originalTopic: "order.created",
                    dlqTopic: "order.created.dlq",
                    partition: 0,
                    offset: "101",
                    key: "order-1",
                    consumerGroup: "order-service-group",
                    isPoisonPill: true,
                    errorMessage: "SyntaxError: Unexpected token",
                    errorName: "SyntaxError",
                    errorStack: "SyntaxError: Unexpected token...",
                    attemptCount: 1,
                    replayCount: 0,
                    status: "PENDING",
                    rawPayload: '{"orderId": "order-1"}',
                    failedAt: "2026-11-10T12:00:00.000Z",
                  },
                },
              ],
            },
          },
        };
      },
    } as any;

    const dlqResult = await searchDlqRecords(mockClient, {
      topic: "order.created",
      status: "PENDING",
      isPoisonPill: true,
      query: "SyntaxError",
      page: 1,
      limit: 10,
    });

    assert.strictEqual(dlqResult.total, 1);
    assert.strictEqual(dlqResult.records.length, 1);
    assert.strictEqual(dlqResult.records[0]?.id, "order.created.dlq-0-101");
    assert.strictEqual(dlqResult.records[0]?.isPoisonPill, true);
    assert.strictEqual(capturedSearchBody.size, 10);
    assert.strictEqual(capturedSearchBody.from, 0);

    const must = capturedSearchBody.query.bool.must;
    assert.ok(must.find((m: any) => m.term?.originalTopic === "order.created"));
    assert.ok(must.find((m: any) => m.term?.status === "PENDING"));
    assert.ok(must.find((m: any) => m.term?.isPoisonPill === true));
    assert.ok(must.find((m: any) => m.multi_match?.query === "SyntaxError"));
    console.log(
      "  ✓ DLQ search query parameters properly translated to bool query",
    );

    console.log("\n==================================================");
    console.log("🎉 All @repo/opensearch Tests Passed Cleanly!");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ Test failure:", err);
    process.exit(1);
  }
}

runOpenSearchTests();
