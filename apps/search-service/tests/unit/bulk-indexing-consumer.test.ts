import assert from "node:assert/strict";
import { IndexingService } from "../../src/services/indexing.service.js";
import { registerProductEventSubscriptions } from "../../src/consumers/product-events.consumer.js";
import { config } from "../../src/config/config.js";

export async function runBulkIndexingConsumerTests(): Promise<void> {
  console.log(
    "\n▶ [UNIT] Running OpenSearch Real-Time Bulk Indexing & Micro-Batching Tests...",
  );

  // ---------------------------------------------------------------------------
  // TEST 1: IndexingService.bulkExecuteOperations Empty Handling
  // ---------------------------------------------------------------------------
  {
    const indexing = new IndexingService();
    const result = await indexing.bulkExecuteOperations([]);
    assert.equal(result.successful, 0);
    assert.equal(result.failed, 0);
    console.log("  ✓ bulkExecuteOperations cleanly handles empty operation lists");
  }

  // ---------------------------------------------------------------------------
  // TEST 2: registerProductEventSubscriptions with subscribeBatch
  // ---------------------------------------------------------------------------
  {
    let subscribedBatchConfig: any[] = [];
    const mockBatchConsumer = {
      subscribeBatch: async (topics: any[]) => {
        subscribedBatchConfig = topics;
      },
      subscribe: async () => {
        throw new Error("Should not use single subscribe when subscribeBatch is available");
      },
    };

    await registerProductEventSubscriptions(mockBatchConsumer);
    assert.equal(subscribedBatchConfig.length, 9, "Should register 9 batch topics");

    const createdTopic = subscribedBatchConfig.find(
      (t) => t.topicName === config.kafka.topics.productCreated,
    );
    assert.ok(createdTopic, "product.created topic registered");
    assert.equal(createdTopic.batchSize, 100, "Configured batchSize is 100");

    console.log("  ✓ subscribeBatch registered with 100-document micro-batching");
  }

  // ---------------------------------------------------------------------------
  // TEST 3: registerProductEventSubscriptions fallback to subscribe
  // ---------------------------------------------------------------------------
  {
    let subscribedTopics: any[] = [];
    const mockLegacyConsumer = {
      subscribe: async (topics: any[]) => {
        subscribedTopics = topics;
      },
    };

    await registerProductEventSubscriptions(mockLegacyConsumer);
    assert.equal(subscribedTopics.length, 9, "Should register 9 legacy fallback topics");
    console.log("  ✓ Seamless fallback to single-message subscribe when subscribeBatch is unavailable");
  }

  console.log("✔ [UNIT] OpenSearch Real-Time Bulk Indexing & Micro-Batching Tests Passed");
}

